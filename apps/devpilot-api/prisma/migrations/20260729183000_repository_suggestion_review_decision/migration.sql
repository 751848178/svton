ALTER TABLE `RepositoryAnalysisSuggestion`
    ADD COLUMN `reviewDecision` VARCHAR(191) NULL AFTER `proposedValue`;
