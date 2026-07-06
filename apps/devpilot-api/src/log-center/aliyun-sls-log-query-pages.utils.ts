import {
  ProviderRequestPolicy,
  executeProviderCall,
} from "../common/retry/provider-retry";
import {
  AliyunSlsClient,
  AliyunSlsLogQueryInput,
  AliyunSlsSdk,
} from "./aliyun-sls-log-query.types";
import {
  queryContainsAnalyticSql,
  readAliyunSlsResponseRows,
} from "./aliyun-sls-log-query-rows.utils";

export async function getAliyunSlsLogPages(
  client: AliyunSlsClient,
  slsSdk: AliyunSlsSdk,
  input: AliyunSlsLogQueryInput,
  requestPolicy: ProviderRequestPolicy,
) {
  const rows: Array<Record<string, unknown>> = [];
  const maxRows = Math.max(1, Math.min(Math.floor(input.limit), 1000));
  const pageSize = Math.min(maxRows, 100);
  const fromSeconds = Math.floor(input.from.getTime() / 1000);
  const toSeconds = Math.max(
    fromSeconds + 1,
    Math.floor(input.to.getTime() / 1000),
  );

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const response = await executeProviderCall(
      requestPolicy,
      `Aliyun SLS GetLogs ${input.project}/${input.logstore} offset ${offset}`,
      () =>
        client.getLogs(
          input.project,
          input.logstore,
          new slsSdk.GetLogsRequest({
            from: fromSeconds,
            to: toSeconds,
            query: input.query,
            line: Math.min(pageSize, maxRows - offset),
            offset,
            reverse: true,
          }),
        ),
    );
    const pageRows = readAliyunSlsResponseRows(response);
    rows.push(...pageRows);

    if (
      pageRows.length < pageSize ||
      rows.length >= maxRows ||
      queryContainsAnalyticSql(input.query)
    ) {
      break;
    }
  }

  return rows.slice(0, maxRows);
}
