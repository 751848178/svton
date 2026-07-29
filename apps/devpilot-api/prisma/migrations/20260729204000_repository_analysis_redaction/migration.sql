UPDATE `RepositoryAnalysisSuggestion`
SET
  `currentValue` = CASE
    WHEN `currentValue` IS NULL THEN NULL
    ELSE JSON_REMOVE(
      `currentValue`,
      '$.deployConfig.buildCommand',
      '$.deployConfig.deployCommand',
      '$.deployConfig.migrationCommand',
      '$.deployConfig.initializationCommand',
      '$.deployConfig.seedCommand',
      '$.deployConfig.backfillCommand'
    )
  END,
  `proposedValue` = JSON_REMOVE(
    `proposedValue`,
    '$.deployConfig.buildCommand',
    '$.deployConfig.deployCommand',
    '$.deployConfig.migrationCommand',
    '$.deployConfig.initializationCommand',
    '$.deployConfig.seedCommand',
    '$.deployConfig.backfillCommand'
  ),
  `reviewedValue` = CASE
    WHEN `reviewedValue` IS NULL THEN NULL
    ELSE JSON_REMOVE(
      `reviewedValue`,
      '$.deployConfig.buildCommand',
      '$.deployConfig.deployCommand',
      '$.deployConfig.migrationCommand',
      '$.deployConfig.initializationCommand',
      '$.deployConfig.seedCommand',
      '$.deployConfig.backfillCommand'
    )
  END,
  `warnings` = JSON_ARRAY_APPEND(
    COALESCE(`warnings`, JSON_ARRAY()),
    '$',
    '历史命令字段已因安全策略移除；需要时请重新解析仓库。'
  )
WHERE `kind` = 'application_service';

UPDATE `RepositoryAnalysisRun`
SET `result` = NULL
WHERE `result` IS NOT NULL;
