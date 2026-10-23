CREATE TABLE `app_settings` (
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidate_experience` (
	`id` varchar(32) NOT NULL,
	`candidateId` varchar(32) NOT NULL,
	`companyName` varchar(180),
	`role` varchar(180) NOT NULL,
	`startedAt` varchar(24),
	`endedAt` varchar(24),
	`achievements` text,
	CONSTRAINT `candidate_experience_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidate_job_matches` (
	`id` varchar(32) NOT NULL,
	`candidateId` varchar(32) NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`score` int NOT NULL,
	`isEligible` boolean NOT NULL DEFAULT true,
	`explanation` json NOT NULL,
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `candidate_job_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidate_skills` (
	`id` varchar(32) NOT NULL,
	`candidateId` varchar(32) NOT NULL,
	`skillName` varchar(160) NOT NULL,
	`normalizedSkill` varchar(160) NOT NULL,
	`skillType` enum('hard','soft','language','certification') NOT NULL,
	CONSTRAINT `candidate_skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidates` (
	`id` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`displayName` varchar(180) NOT NULL,
	`communeName` varchar(100),
	`regionCode` varchar(4),
	`regionName` varchar(100),
	`communeCode` varchar(8),
	`regionsAvailable` json NOT NULL,
	`willingToRelocate` boolean NOT NULL DEFAULT false,
	`preferredTitles` json NOT NULL,
	`compatibleTitles` json NOT NULL,
	`sectors` json NOT NULL,
	`yearsExperience` int NOT NULL DEFAULT 0,
	`education` json NOT NULL,
	`certifications` json NOT NULL,
	`licenses` json NOT NULL,
	`hardSkills` json NOT NULL,
	`softSkills` json NOT NULL,
	`languages` json NOT NULL,
	`seniority` varchar(64),
	`acceptedModalities` json NOT NULL,
	`acceptedSchedules` json NOT NULL,
	`preferredContracts` json NOT NULL,
	`salaryTargetCLP` int,
	`salaryBasisPreference` enum('gross','net','unknown') NOT NULL DEFAULT 'unknown',
	`privateNotes` text,
	`consentGiven` boolean NOT NULL DEFAULT false,
	`consentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`deletedAt` timestamp,
	CONSTRAINT `candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` varchar(32) NOT NULL,
	`canonicalName` varchar(255) NOT NULL,
	`normalizedName` varchar(255) NOT NULL,
	`confidential` boolean NOT NULL DEFAULT false,
	`website` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cv_documents` (
	`id` varchar(32) NOT NULL,
	`candidateId` varchar(32) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`extractedText` longtext,
	`extractionStatus` enum('text_extracted','manual_review','failed') NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`deletedAt` timestamp,
	CONSTRAINT `cv_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`format` enum('csv','json') NOT NULL,
	`rowCount` int NOT NULL DEFAULT 0,
	`importedCount` int NOT NULL DEFAULT 0,
	`duplicateCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` varchar(32) NOT NULL,
	`batchId` varchar(32) NOT NULL,
	`rowNumber` int NOT NULL,
	`status` enum('imported','duplicate','error') NOT NULL,
	`message` text,
	`jobId` varchar(32),
	`rawRow` json,
	CONSTRAINT `import_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_notes` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`note` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_notes_user_job_uq` UNIQUE(`userId`,`jobId`)
);
--> statement-breakpoint
CREATE TABLE `job_skills` (
	`id` varchar(32) NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`skillName` varchar(160) NOT NULL,
	`normalizedSkill` varchar(160) NOT NULL,
	CONSTRAINT `job_skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_source_occurrences` (
	`id` varchar(32) NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`sourceCode` varchar(64) NOT NULL,
	`sourceExternalId` varchar(255),
	`originalUrl` text,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`verifiedAt` timestamp,
	`provenance` text,
	CONSTRAINT `job_source_occurrences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_sources` (
	`id` varchar(32) NOT NULL,
	`sourceCode` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`sourceUrl` varchar(512),
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastVerifiedAt` timestamp,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `job_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` varchar(32) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`canonicalUrl` text,
	`sourceExternalIds` json NOT NULL,
	`companyId` varchar(32),
	`title` varchar(255) NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`companyConfidential` boolean NOT NULL DEFAULT false,
	`countryCode` varchar(2) NOT NULL DEFAULT 'CL',
	`regionCode` varchar(4),
	`regionName` varchar(100),
	`communeCode` varchar(8),
	`communeName` varchar(100),
	`locality` varchar(150),
	`addressApprox` varchar(255),
	`modality` enum('presencial','hibrida','remota','no_informada') NOT NULL DEFAULT 'no_informada',
	`category` varchar(120),
	`subcategory` varchar(120),
	`sector` varchar(120),
	`seniority` varchar(64),
	`jobType` varchar(64),
	`contractType` varchar(64),
	`schedule` varchar(64),
	`experienceMinYears` int,
	`educationLevel` varchar(100),
	`salaryMinCLP` int,
	`salaryMaxCLP` int,
	`salaryPeriod` varchar(32) NOT NULL DEFAULT 'monthly',
	`salaryBasis` enum('gross','net','unknown') NOT NULL DEFAULT 'unknown',
	`salaryIsDisclosed` boolean NOT NULL DEFAULT false,
	`description` longtext NOT NULL,
	`responsibilities` json NOT NULL,
	`requirements` json NOT NULL,
	`mandatoryRequirements` json NOT NULL,
	`benefits` json NOT NULL,
	`skills` json NOT NULL,
	`sourceCodes` json NOT NULL,
	`publishedAt` timestamp,
	`expiresAt` timestamp,
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastVerifiedAt` timestamp,
	`verificationStatus` enum('vigente','por_verificar','vencido','archivado') NOT NULL DEFAULT 'por_verificar',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_fingerprint_uq` UNIQUE(`fingerprint`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` varchar(32) NOT NULL,
	`regionCode` varchar(4) NOT NULL,
	`regionName` varchar(100) NOT NULL,
	`communeCode` varchar(8) NOT NULL,
	`communeName` varchar(100) NOT NULL,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_region_commune_uq` UNIQUE(`regionCode`,`communeCode`)
);
--> statement-breakpoint
CREATE TABLE `saved_jobs` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`jobId` varchar(32) NOT NULL,
	`tags` json NOT NULL,
	`discardedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_jobs_user_job_uq` UNIQUE(`userId`,`jobId`)
);
--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`filters` json NOT NULL,
	`resultCount` int NOT NULL DEFAULT 0,
	`lastExecutedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_connectors` (
	`id` varchar(64) NOT NULL,
	`label` varchar(128) NOT NULL,
	`status` enum('available','pending','disconnected') NOT NULL DEFAULT 'pending',
	`adapterContract` varchar(64) NOT NULL,
	`lastRunAt` timestamp,
	`lastVerifiedAt` timestamp,
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_connectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_user_created_idx` ON `audit_events` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `candidate_experience_candidate_idx` ON `candidate_experience` (`candidateId`);--> statement-breakpoint
CREATE INDEX `candidate_matches_pair_idx` ON `candidate_job_matches` (`candidateId`,`jobId`);--> statement-breakpoint
CREATE INDEX `candidate_matches_score_idx` ON `candidate_job_matches` (`candidateId`,`score`);--> statement-breakpoint
CREATE INDEX `candidate_skills_candidate_idx` ON `candidate_skills` (`candidateId`);--> statement-breakpoint
CREATE INDEX `candidate_skills_name_idx` ON `candidate_skills` (`normalizedSkill`);--> statement-breakpoint
CREATE INDEX `candidates_owner_idx` ON `candidates` (`ownerId`);--> statement-breakpoint
CREATE INDEX `candidates_commune_idx` ON `candidates` (`communeName`);--> statement-breakpoint
CREATE INDEX `companies_normalized_name_idx` ON `companies` (`normalizedName`);--> statement-breakpoint
CREATE INDEX `cv_documents_candidate_idx` ON `cv_documents` (`candidateId`);--> statement-breakpoint
CREATE INDEX `import_rows_batch_idx` ON `import_rows` (`batchId`);--> statement-breakpoint
CREATE INDEX `job_skills_job_idx` ON `job_skills` (`jobId`);--> statement-breakpoint
CREATE INDEX `job_skills_name_idx` ON `job_skills` (`normalizedSkill`);--> statement-breakpoint
CREATE INDEX `occurrences_job_idx` ON `job_source_occurrences` (`jobId`);--> statement-breakpoint
CREATE INDEX `occurrences_source_idx` ON `job_source_occurrences` (`sourceCode`);--> statement-breakpoint
CREATE INDEX `job_sources_code_idx` ON `job_sources` (`sourceCode`);--> statement-breakpoint
CREATE INDEX `jobs_location_idx` ON `jobs` (`regionCode`,`communeCode`);--> statement-breakpoint
CREATE INDEX `jobs_status_date_idx` ON `jobs` (`verificationStatus`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `jobs_category_idx` ON `jobs` (`category`);--> statement-breakpoint
CREATE INDEX `jobs_company_idx` ON `jobs` (`companyName`);--> statement-breakpoint
CREATE INDEX `locations_region_commune_idx` ON `locations` (`regionCode`,`communeCode`);--> statement-breakpoint
CREATE INDEX `locations_commune_name_idx` ON `locations` (`communeName`);--> statement-breakpoint
CREATE INDEX `saved_jobs_user_idx` ON `saved_jobs` (`userId`);--> statement-breakpoint
CREATE INDEX `saved_searches_user_idx` ON `saved_searches` (`userId`);