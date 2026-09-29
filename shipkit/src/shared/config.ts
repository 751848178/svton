// Controller config (ship.config.yaml) resolution and validation. CLI-side only.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { isRecord, asString, asNumber } from './obj.js';
import type { ShipConfig, TargetConfig, TencentCvmConfig } from './types.js';

export class ConfigError extends Error {}

const CONFIG_FILENAMES = ['ship.config.yaml', 'ship.config.yml', 'ship.config.json'];

export function resolveConfigPath(explicit?: string): string {
  if (explicit) {
    if (!existsSync(explicit)) throw new ConfigError(`config not found: ${explicit}`);
    return explicit;
  }
  for (const f of CONFIG_FILENAMES) if (existsSync(f)) return f;
  const home = process.env.HOME ? path.join(process.env.HOME, '.ship', 'config.yaml') : null;
  if (home && existsSync(home)) return home;
  throw new ConfigError('config not found: pass --config PATH or create ship.config.yaml (template: shipkit/ship.config.example.yaml)');
}

export function loadConfig(explicit?: string): ShipConfig {
  const file = resolveConfigPath(explicit);
  const text = readFileSync(file, 'utf8');
  let raw: unknown;
  try {
    raw = file.endsWith('.json') ? JSON.parse(text) : yaml.load(text);
  } catch (e) {
    throw new ConfigError(`invalid config file ${file}: ${(e as Error).message}`);
  }
  return validateConfig(raw);
}

function validateTarget(t: unknown, at: string): TargetConfig {
  if (!isRecord(t)) throw new ConfigError(`${at} must be a mapping with url + token`);
  const url = asString(t.url);
  if (!url || !/^https?:\/\//.test(url)) throw new ConfigError(`${at}.url must start with http(s)://`);
  const token = asString(t.token);
  if (!token) throw new ConfigError(`${at}.token is required`);
  return { url: url.replace(/\/+$/, ''), token };
}

function requireString(t: Record<string, unknown>, key: string, at: string): string {
  const v = asString(t[key]);
  if (!v) throw new ConfigError(`${at}.${key} is required`);
  return v;
}

function validateTencent(t: unknown): TencentCvmConfig {
  if (!isRecord(t)) throw new ConfigError('builder.dynamic.tencent must be a mapping (see ship.config.example.yaml)');
  const at = 'builder.dynamic.tencent';
  const installUrl = asString(t.installUrl);
  const cfg: TencentCvmConfig = {
    region: requireString(t, 'region', at),
    zone: requireString(t, 'zone', at),
    instanceType: requireString(t, 'instanceType', at),
    imageId: requireString(t, 'imageId', at),
    vpcId: requireString(t, 'vpcId', at),
    subnetId: requireString(t, 'subnetId', at),
    securityGroupIds: [],
    advertiseHost: asString(t.advertiseHost),
    installUrl: installUrl || undefined,
    installToken: asString(t.installToken) || undefined,
    preInstallScript: asString(t.preInstallScript) || undefined,
    loginPassword: asString(t.loginPassword) || undefined,
  };
  if (!installUrl && !cfg.advertiseHost) {
    throw new ConfigError(`${at}.advertiseHost is required (or set installUrl for a self-hosted bootstrap source)`);
  }
  if (installUrl && !cfg.installToken) {
    throw new ConfigError(`${at}.installToken is required together with installUrl (the token baked into that installer)`);
  }
  const sg = t.securityGroupIds;
  if (!Array.isArray(sg) || sg.length === 0 || sg.some((s) => typeof s !== 'string')) {
    throw new ConfigError(`${at}.securityGroupIds must be a non-empty list of strings`);
  }
  cfg.securityGroupIds = sg as string[];
  const bw = asNumber(t.internetMaxBandwidthOut);
  if (bw !== undefined) { if (bw < 1 || bw > 100) throw new ConfigError(`${at}.internetMaxBandwidthOut must be 1-100`); cfg.internetMaxBandwidthOut = bw; }
  const maxLifetime = asNumber(t.maxLifetimeMinutes);
  if (maxLifetime !== undefined) {
    // must at least cover provisioning alone: IP wait 15' + install 20' + buffer (RA03)
    if (maxLifetime < 60 || maxLifetime > 1440) throw new ConfigError(`${at}.maxLifetimeMinutes must be 60-1440`);
    cfg.maxLifetimeMinutes = maxLifetime;
  }
  const scheme = asString(t.agentScheme);
  if (scheme !== undefined) {
    if (scheme !== 'http' && scheme !== 'https') throw new ConfigError(`${at}.agentScheme must be http or https`);
    cfg.agentScheme = scheme;
  }
  const agentHost = asString(t.agentHost);
  if (agentHost) {
    if (/^https?:\/\//.test(agentHost) || /[:\s]/.test(agentHost)) {
      throw new ConfigError(`${at}.agentHost must be a bare host without port — set the port via ${at}.agentPort`);
    }
    cfg.agentHost = agentHost;
  }
  const agentPort = asNumber(t.agentPort);
  if (agentPort !== undefined) { if (agentPort < 1 || agentPort > 65535) throw new ConfigError(`${at}.agentPort must be 1-65535`); cfg.agentPort = agentPort; }
  const bundleBaseUrl = asString(t.bundleBaseUrl);
  if (bundleBaseUrl !== undefined) {
    if (!/^https:\/\//.test(bundleBaseUrl)) throw new ConfigError(`${at}.bundleBaseUrl must be an https:// URL (secure bootstrap, RA06)`);
    cfg.bundleBaseUrl = bundleBaseUrl;
  }
  const bundlePort = asNumber(t.bundlePort);
  if (bundlePort !== undefined) { if (bundlePort < 1024 || bundlePort > 65535) throw new ConfigError(`${at}.bundlePort must be 1024-65535`); cfg.bundlePort = bundlePort; }
  const name = asString(t.instanceName);
  if (name) cfg.instanceName = name;
  return cfg;
}

export function validateConfig(raw: unknown): ShipConfig {
  if (!isRecord(raw)) throw new ConfigError('config must be a mapping');
  const builder = raw.builder;
  if (!isRecord(builder)) throw new ConfigError('builder section is required');
  const mode = asString(builder.mode);
  if (mode !== 'static' && mode !== 'dynamic') throw new ConfigError("builder.mode must be 'static' or 'dynamic'");
  const cfg: ShipConfig = { builder: { mode }, runtime: { targets: {} } };

  if (mode === 'static') {
    cfg.builder.static = validateTarget(builder.static, 'builder.static');
  } else {
    const d = builder.dynamic;
    if (!isRecord(d)) throw new ConfigError('builder.dynamic is required for dynamic mode');
    if (asString(d.provider) !== 'tencent') throw new ConfigError("builder.dynamic.provider must be 'tencent' (more cloud adapters later)");
    const keep = asNumber(d.keepMinutes);
    if (keep !== undefined && (keep < 0 || keep > 1440)) throw new ConfigError('builder.dynamic.keepMinutes must be 0-1440');
    cfg.builder.dynamic = { provider: 'tencent', keepMinutes: keep ?? 30, tencent: validateTencent(d.tencent) };
  }

  if (raw.registry !== undefined) {
    if (!isRecord(raw.registry)) throw new ConfigError('registry must be a mapping with url + namespace');
    const url = requireString(raw.registry, 'url', 'registry');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*(:\d{1,5})?$/.test(url)) {
      throw new ConfigError(`registry.url must be a bare host[:port] (no scheme/path/spaces), got '${url}'`);
    }
    const ns = requireString(raw.registry, 'namespace', 'registry');
    if (!/^[a-z0-9][a-z0-9._-]{0,60}$/.test(ns)) {
      throw new ConfigError(`registry.namespace must match [a-z0-9._-], got '${ns}'`);
    }
    cfg.registry = { url, namespace: ns };
  }

  const runtime = raw.runtime;
  if (!isRecord(runtime) || !isRecord(runtime.targets) || Object.keys(runtime.targets).length === 0) {
    throw new ConfigError('runtime.targets must contain at least one entry');
  }
  for (const [name, t] of Object.entries(runtime.targets)) {
    cfg.runtime.targets[name] = validateTarget(t, `runtime.targets.${name}`);
  }

  if (raw.source !== undefined && isRecord(raw.source)) {
    cfg.source = { repo: asString(raw.source.repo), ref: asString(raw.source.ref) };
  }
  return cfg;
}
