ALTER TABLE `DecisionSession` DROP FOREIGN KEY `DecisionSession_userId_fkey`;

DROP TABLE `DecisionSession`;

CREATE TABLE `DecisionSession` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `question` TEXT NOT NULL,
  `questionType` VARCHAR(191) NOT NULL,
  `processingStage` VARCHAR(191) NOT NULL,
  `processingStatus` VARCHAR(191) NOT NULL,
  `finalStatus` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `confidence` DOUBLE NOT NULL,
  `variablesJson` JSON NOT NULL,
  `analysesJson` JSON NOT NULL,
  `summaryJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `DecisionSession_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DecisionSession` ADD CONSTRAINT `DecisionSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
