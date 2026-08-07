-- F447 AC-SET-039: persist the change summary on the immutable revision row so
-- the settings page can display 来源/时间/变更说明/创建人 together. Additive;
-- existing rows keep NULL and render as "无变更说明".

ALTER TABLE `EnvironmentConfigRevision` ADD COLUMN `changeSummary` TEXT NULL;
