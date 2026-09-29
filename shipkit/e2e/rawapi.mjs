// Generic TC3-signed Tencent API caller (validated against cvm; works for any service).
import { createHmac, createHash } from 'node:crypto';

export async function call(service, version, action, payload, region = 'ap-guangzhou') {
  const host = `${service}.tencentcloudapi.com`;
  const secretId = process.env.TENCENTCLOUD_SECRET_ID;
  const secretKey = process.env.TENCENTCLOUD_SECRET_KEY;
  if (!secretId || !secretKey) throw new Error('TENCENTCLOUD_SECRET_ID/KEY env required');
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload ?? {});
  const hashed = createHash('sha256').update(body).digest('hex');
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, hashed].join('\n');
  const scope = `${date}/${service}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', timestamp, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const hmac = (k, m) => createHmac('sha256', k).update(m).digest();
  const signature = hmac(hmac(hmac(hmac(Buffer.from(`TC3${secretKey}`), date), service), 'tc3_request'), stringToSign).toString('hex');
  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tc-action': action,
      'x-tc-version': version,
      'x-tc-timestamp': String(timestamp),
      'x-tc-region': region,
      authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body,
  });
  const data = await res.json();
  if (data.Response?.Error) throw new Error(`${data.Response.Error.Code}: ${data.Response.Error.Message}`);
  return data.Response;
}
