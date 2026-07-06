import type { ResourceMetricField } from "./monitoring-alert-resource-metric-threshold.types";

export const resourceMetricFields: Record<string, ResourceMetricField> = {
  cpuPercent: { key: "cpuPercent", label: "CPU", unit: "percent" },
  memoryPercent: { key: "memoryPercent", label: "内存", unit: "percent" },
  memoryUsageBytes: {
    key: "memoryUsageBytes",
    label: "内存用量",
    unit: "bytes",
  },
  networkInputBytes: {
    key: "networkInputBytes",
    label: "网络入流量",
    unit: "bytes",
  },
  networkOutputBytes: {
    key: "networkOutputBytes",
    label: "网络出流量",
    unit: "bytes",
  },
  blockInputBytes: {
    key: "blockInputBytes",
    label: "块 IO 入流量",
    unit: "bytes",
  },
  blockOutputBytes: {
    key: "blockOutputBytes",
    label: "块 IO 出流量",
    unit: "bytes",
  },
  pids: { key: "pids", label: "PIDs", unit: "count" },
};
