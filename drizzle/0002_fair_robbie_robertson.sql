CREATE TABLE `ats_company_boards` (
	`id` varchar(32) NOT NULL,
	`companyId` varchar(32),
	`companyName` varchar(255) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`boardId` varchar(255) NOT NULL,
	`countryCode` varchar(2) NOT NULL DEFAULT 'CL',
	`physicalLocationSummary` varchar(255),
	`chilePhysicalSiteVerified` boolean NOT NULL DEFAULT false,
	`workplaceEvidence` text,
	`verificationStatus` enum('pending','verified','inactive') NOT NULL DEFAULT 'pending',
	`connectionStatus` enum('not_connected','connected') NOT NULL DEFAULT 'not_connected',
	`active` boolean NOT NULL DEFAULT true,
	`verifiedAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ats_company_boards_id` PRIMARY KEY(`id`),
	CONSTRAINT `ats_board_provider_board_uq` UNIQUE(`provider`,`boardId`)
);
--> statement-breakpoint
ALTER TABLE `jobs` MODIFY COLUMN `salaryPeriod` varchar(32) NOT NULL DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `source_connectors` MODIFY COLUMN `status` enum('available','pending','disconnected','not_connected') NOT NULL DEFAULT 'not_connected';--> statement-breakpoint
ALTER TABLE `candidates` ADD `experienceYearsKnown` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `educationKnown` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `candidates` ADD `credentialsKnown` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_source_occurrences` ADD `sourceKind` varchar(32) DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_source_occurrences` ADD `rawRecordHash` varchar(64);--> statement-breakpoint
ALTER TABLE `job_source_occurrences` ADD `sourceObservedAt` timestamp;--> statement-breakpoint
ALTER TABLE `job_source_occurrences` ADD `rawFields` json;--> statement-breakpoint
ALTER TABLE `job_source_occurrences` ADD `evidence` json;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `sourceKind` varchar(32) DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `accessMode` varchar(32) DEFAULT 'manual_only' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `capabilities` json;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `canRead` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `hasStructuredSalary` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `hasPublishedAt` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `hasExpiryDate` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `hasWorkplaceType` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `hasFullDescription` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `supportsComuna` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `requiresCredential` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `sourceStatus` enum('available','pending','disconnected','not_connected') DEFAULT 'not_connected' NOT NULL;--> statement-breakpoint
ALTER TABLE `job_sources` ADD `lastSuccessfulSync` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `allSourceUrls` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `originalTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `jobs` ADD `normalizedTitle` varchar(255);--> statement-breakpoint
ALTER TABLE `jobs` ADD `companySector` varchar(160);--> statement-breakpoint
ALTER TABLE `jobs` ADD `cityRaw` varchar(180);--> statement-breakpoint
ALTER TABLE `jobs` ADD `locationRaw` varchar(500);--> statement-breakpoint
ALTER TABLE `jobs` ADD `officeLocation` varchar(255);--> statement-breakpoint
ALTER TABLE `jobs` ADD `geoConfidence` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `geoEvidence` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `inferredSector` varchar(120);--> statement-breakpoint
ALTER TABLE `jobs` ADD `department` varchar(180);--> statement-breakpoint
ALTER TABLE `jobs` ADD `team` varchar(180);--> statement-breakpoint
ALTER TABLE `jobs` ADD `occupationCodeCiuo` varchar(32);--> statement-breakpoint
ALTER TABLE `jobs` ADD `inferredSeniority` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `employmentType` varchar(80);--> statement-breakpoint
ALTER TABLE `jobs` ADD `scheduleType` varchar(80);--> statement-breakpoint
ALTER TABLE `jobs` ADD `shift` varchar(80);--> statement-breakpoint
ALTER TABLE `jobs` ADD `hoursPerWeek` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `vacancyCount` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `practiceType` varchar(40);--> statement-breakpoint
ALTER TABLE `jobs` ADD `workplaceType` enum('on_site','hybrid','remote','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `workplaceEvidence` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `experienceRaw` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `degreeNames` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `skillsExplicit` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `licenses` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `languages` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryMinSource` decimal(14,2);--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryMaxSource` decimal(14,2);--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryRaw` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryCurrency` varchar(12);--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryVisibility` enum('disclosed','reserved','not_disclosed','unknown') DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryComponents` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `salaryEvidence` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `descriptionHtmlSanitized` longtext;--> statement-breakpoint
ALTER TABLE `jobs` ADD `applicationUrl` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `applicationMethod` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requiredDocuments` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `recruitmentStages` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `normalizedSkills` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `sourceEvidence` json;--> statement-breakpoint
ALTER TABLE `jobs` ADD `companyBoardId` varchar(255);--> statement-breakpoint
ALTER TABLE `jobs` ADD `rawRecordHash` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `sourceObservedAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `recordUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `jobs` ADD `sourceStatus` varchar(64);--> statement-breakpoint
ALTER TABLE `jobs` ADD `availabilityConfidence` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `dataCompleteness` int;--> statement-breakpoint
ALTER TABLE `jobs` ADD `searchIndex` longtext;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `sourceKind` varchar(32) DEFAULT 'open_web' NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `accessMode` varchar(32) DEFAULT 'scraper_pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `capabilities` json;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `canRead` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `hasStructuredSalary` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `hasPublishedAt` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `hasExpiryDate` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `hasWorkplaceType` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `hasFullDescription` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `supportsComuna` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `requiresCredential` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `sourceStatus` enum('available','pending','disconnected','not_connected') DEFAULT 'not_connected' NOT NULL;--> statement-breakpoint
ALTER TABLE `source_connectors` ADD `lastSuccessfulSync` timestamp;--> statement-breakpoint
CREATE INDEX `ats_board_company_idx` ON `ats_company_boards` (`companyName`);--> statement-breakpoint
CREATE INDEX `ats_board_provider_idx` ON `ats_company_boards` (`provider`);--> statement-breakpoint
CREATE INDEX `jobs_occupation_code_idx` ON `jobs` (`occupationCodeCiuo`);--> statement-breakpoint
CREATE INDEX `jobs_board_idx` ON `jobs` (`companyBoardId`);