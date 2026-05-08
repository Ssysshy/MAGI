ALTER TABLE `DecisionSession`
  ADD COLUMN `processingStage` VARCHAR(191) NULL,
  ADD COLUMN `processingStatus` VARCHAR(191) NULL;

UPDATE `DecisionSession`
SET
  `processingStage` = 'completed',
  `processingStatus` = 'completed'
WHERE `processingStage` IS NULL
   OR `processingStatus` IS NULL;

ALTER TABLE `DecisionSession`
  MODIFY `processingStage` VARCHAR(191) NOT NULL,
  MODIFY `processingStatus` VARCHAR(191) NOT NULL;
