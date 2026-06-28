-- Add webhook deployment policy and delivery idempotency.
ALTER TABLE `ProjectWebhook`
  ADD COLUMN `environmentId` VARCHAR(191) NULL,
  ADD COLUMN `deploymentMode` VARCHAR(191) NOT NULL DEFAULT 'dry_run',
  ADD COLUMN `maxAttempts` INTEGER NOT NULL DEFAULT 1;

ALTER TABLE `WebhookDelivery`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE INDEX `ProjectWebhook_environmentId_idx` ON `ProjectWebhook`(`environmentId`);
CREATE INDEX `ProjectWebhook_deploymentMode_idx` ON `ProjectWebhook`(`deploymentMode`);
CREATE INDEX `WebhookDelivery_providerEventId_idx` ON `WebhookDelivery`(`providerEventId`);
CREATE INDEX `WebhookDelivery_idempotencyKey_idx` ON `WebhookDelivery`(`idempotencyKey`);
CREATE UNIQUE INDEX `WebhookDelivery_webhookId_idempotencyKey_key` ON `WebhookDelivery`(`webhookId`, `idempotencyKey`);

ALTER TABLE `ProjectWebhook`
  ADD CONSTRAINT `ProjectWebhook_environmentId_fkey`
  FOREIGN KEY (`environmentId`) REFERENCES `ProjectEnvironment`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
