-- CreateTable
CREATE TABLE `papers` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `title_lang` VARCHAR(191) NULL,
    `abstract_raw` TEXT NULL,
    `abstract_display_policy` ENUM('full', 'summary_only', 'link_only') NOT NULL DEFAULT 'summary_only',
    `published_date` DATE NULL,
    `language` VARCHAR(191) NULL,
    `origin` ENUM('local', 'international') NOT NULL,
    `venue_id` VARCHAR(191) NULL,
    `venue_name_raw` VARCHAR(191) NULL,
    `venue_country` VARCHAR(191) NULL,
    `source_tier` ENUM('tier_1', 'tier_2', 'tier_3') NOT NULL DEFAULT 'tier_3',
    `tier_reason` VARCHAR(191) NULL,
    `is_foundational` BOOLEAN NOT NULL DEFAULT false,
    `metadata_status` ENUM('indexed', 'queued_review', 'rejected', 'withdrawn') NOT NULL DEFAULT 'indexed',
    `inclusion_basis` VARCHAR(191) NULL,
    `canonical_url` VARCHAR(191) NULL,
    `license_raw` VARCHAR(191) NULL,
    `license_normalized` ENUM('cc_by', 'cc_by_sa', 'cc_by_nc', 'cc_by_nc_sa', 'cc0', 'other_open', 'restricted', 'unknown') NOT NULL DEFAULT 'unknown',
    `affiliation_inferred` BOOLEAN NOT NULL DEFAULT false,
    `enrichment_status` ENUM('pending', 'enriched_openalex', 'no_doi', 'not_found_openalex', 'failed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `papers_published_date_idx`(`published_date`),
    INDEX `papers_origin_idx`(`origin`),
    INDEX `papers_source_tier_idx`(`source_tier`),
    INDEX `papers_metadata_status_idx`(`metadata_status`),
    FULLTEXT INDEX `papers_title_abstract_raw_idx`(`title`, `abstract_raw`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_affiliation_countries` (
    `paper_id` VARCHAR(191) NOT NULL,
    `country_code` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`paper_id`, `country_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_titles` (
    `paper_id` VARCHAR(191) NOT NULL,
    `language` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`paper_id`, `language`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_identifiers` (
    `id` VARCHAR(191) NOT NULL,
    `paper_id` VARCHAR(191) NOT NULL,
    `id_type` ENUM('doi', 'arxiv_id', 'openreview_id', 'openalex_id', 'oai_identifier', 'semantic_scholar_id') NOT NULL,
    `id_value` VARCHAR(191) NOT NULL,

    INDEX `paper_identifiers_paper_id_idx`(`paper_id`),
    UNIQUE INDEX `paper_identifiers_id_type_id_value_key`(`id_type`, `id_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_merges` (
    `surviving_id` VARCHAR(191) NOT NULL,
    `merged_id` VARCHAR(191) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `merged_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `paper_merges_merged_id_idx`(`merged_id`),
    PRIMARY KEY (`surviving_id`, `merged_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approved_venues` (
    `id` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NOT NULL,
    `venue_type` ENUM('conference', 'journal', 'preprint_repo', 'repository') NOT NULL,
    `tier` ENUM('tier_1', 'tier_2', 'tier_3') NOT NULL,
    `ranking_basis` VARCHAR(191) NULL,
    `openalex_source_id` VARCHAR(191) NULL,
    `issn_l` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `approved_venues_openalex_source_id_key`(`openalex_source_id`),
    UNIQUE INDEX `approved_venues_issn_l_key`(`issn_l`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `venue_arxiv_categories` (
    `venue_id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`venue_id`, `category`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `institutions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NULL,
    `institution_type` VARCHAR(191) NULL,
    `openalex_institution_id` VARCHAR(191) NULL,
    `ror_id` VARCHAR(191) NULL,
    `profile_description` TEXT NULL,

    UNIQUE INDEX `institutions_openalex_institution_id_key`(`openalex_institution_id`),
    UNIQUE INDEX `institutions_ror_id_key`(`ror_id`),
    INDEX `institutions_country_idx`(`country`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `institution_name_variants` (
    `institution_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`institution_id`, `name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `authors` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `orcid_id` VARCHAR(191) NULL,
    `openalex_author_id` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_authors` (
    `paper_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,
    `author_order` INTEGER NOT NULL,

    PRIMARY KEY (`paper_id`, `author_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `author_affiliations` (
    `author_id` VARCHAR(191) NOT NULL,
    `institution_id` VARCHAR(191) NOT NULL,
    `paper_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`author_id`, `institution_id`, `paper_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_topics` (
    `id` VARCHAR(191) NOT NULL,
    `paper_id` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,
    `field` VARCHAR(191) NULL,
    `subfield` VARCHAR(191) NULL,
    `topic` VARCHAR(191) NULL,
    `topic_id` VARCHAR(191) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `score` DOUBLE NULL,

    INDEX `paper_topics_paper_id_idx`(`paper_id`),
    INDEX `paper_topics_subfield_idx`(`subfield`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `summaries` (
    `id` VARCHAR(191) NOT NULL,
    `paper_id` VARCHAR(191) NOT NULL,
    `language` ENUM('id', 'en') NOT NULL DEFAULT 'id',
    `summary_layperson` TEXT NULL,
    `summary_technical` TEXT NULL,
    `relevance_indonesia` TEXT NULL,
    `source_type` ENUM('manual', 'ai_draft', 'ai_reviewed') NOT NULL,
    `provenance` ENUM('from_abstract', 'from_fulltext') NOT NULL DEFAULT 'from_abstract',
    `status` ENUM('draft', 'in_review', 'published', 'rejected') NOT NULL DEFAULT 'draft',
    `authored_by` VARCHAR(191) NULL,
    `reviewed_by` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `summaries_paper_id_language_status_idx`(`paper_id`, `language`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `citation_stats` (
    `paper_id` VARCHAR(191) NOT NULL,
    `citation_count_total` INTEGER NOT NULL DEFAULT 0,
    `citation_by_year` JSON NULL,
    `fwci` DOUBLE NULL,
    `citation_normalized_percentile` DOUBLE NULL,
    `local_percentile` DOUBLE NULL,
    `retraction_status` ENUM('none', 'retracted', 'expression_of_concern') NOT NULL DEFAULT 'none',

    PRIMARY KEY (`paper_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_versions` (
    `id` VARCHAR(191) NOT NULL,
    `paper_id` VARCHAR(191) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `changed_summary` TEXT NULL,
    `version_date` DATE NULL,

    UNIQUE INDEX `paper_versions_paper_id_version_number_key`(`paper_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_relations` (
    `id` VARCHAR(191) NOT NULL,
    `paper_id_old` VARCHAR(191) NOT NULL,
    `paper_id_new` VARCHAR(191) NOT NULL,
    `relation_type` ENUM('superseded_by', 'follow_up_same_author', 'related_semantic', 'contradicted_by', 'extended_by') NOT NULL,
    `confidence_score` DOUBLE NULL,
    `reasoning_text` TEXT NULL,
    `status` ENUM('suggested', 'approved', 'rejected', 'disputed') NOT NULL DEFAULT 'suggested',

    UNIQUE INDEX `paper_relations_paper_id_old_paper_id_new_relation_type_key`(`paper_id_old`, `paper_id_new`, `relation_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `relevance_scores` (
    `paper_id` VARCHAR(191) NOT NULL,
    `computed_score` INTEGER NULL,
    `computed_status` ENUM('too_new_to_score', 'still_relevant', 'needs_update', 'superseded', 'retracted') NOT NULL DEFAULT 'too_new_to_score',
    `computed_reasoning` TEXT NULL,
    `published_status` ENUM('still_relevant', 'needs_update', 'superseded', 'retracted', 'foundational') NULL,
    `published_reasoning` TEXT NULL,
    `override_by` VARCHAR(191) NULL,
    `override_reason` TEXT NULL,

    PRIMARY KEY (`paper_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `policy_tags` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `label_id` VARCHAR(191) NOT NULL,
    `label_en` VARCHAR(191) NULL,
    `tag_group` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `policy_tags_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paper_policy_tags` (
    `paper_id` VARCHAR(191) NOT NULL,
    `tag_id` VARCHAR(191) NOT NULL,
    `status` ENUM('suggested', 'published', 'rejected') NOT NULL DEFAULT 'suggested',

    PRIMARY KEY (`paper_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `role` ENUM('admin', 'editor', 'contributor', 'reader') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `disputes` (
    `id` VARCHAR(191) NOT NULL,
    `paper_id` VARCHAR(191) NOT NULL,
    `dispute_type` VARCHAR(191) NOT NULL,
    `submitted_by_name` VARCHAR(191) NULL,
    `submitted_by_email` VARCHAR(191) NULL,
    `argument` TEXT NOT NULL,
    `status` ENUM('open', 'in_review', 'accepted', 'rejected') NOT NULL DEFAULT 'open',
    `resolution` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` VARCHAR(191) NOT NULL,
    `submitted_by_name` VARCHAR(191) NULL,
    `submitted_by_email` VARCHAR(191) NOT NULL,
    `claimed_identifier` VARCHAR(191) NULL,
    `paper_id` VARCHAR(191) NULL,
    `status` ENUM('queued', 'in_review', 'approved', 'rejected_spam', 'rejected_predatory', 'rejected_duplicate', 'rejected_no_credentials') NOT NULL DEFAULT 'queued',
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `papers` ADD CONSTRAINT `papers_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `approved_venues`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_affiliation_countries` ADD CONSTRAINT `paper_affiliation_countries_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_titles` ADD CONSTRAINT `paper_titles_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_identifiers` ADD CONSTRAINT `paper_identifiers_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_merges` ADD CONSTRAINT `paper_merges_surviving_id_fkey` FOREIGN KEY (`surviving_id`) REFERENCES `papers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `venue_arxiv_categories` ADD CONSTRAINT `venue_arxiv_categories_venue_id_fkey` FOREIGN KEY (`venue_id`) REFERENCES `approved_venues`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `institution_name_variants` ADD CONSTRAINT `institution_name_variants_institution_id_fkey` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_authors` ADD CONSTRAINT `paper_authors_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_authors` ADD CONSTRAINT `paper_authors_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `author_affiliations` ADD CONSTRAINT `author_affiliations_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `author_affiliations` ADD CONSTRAINT `author_affiliations_institution_id_fkey` FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `author_affiliations` ADD CONSTRAINT `author_affiliations_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_topics` ADD CONSTRAINT `paper_topics_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `summaries` ADD CONSTRAINT `summaries_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `citation_stats` ADD CONSTRAINT `citation_stats_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_versions` ADD CONSTRAINT `paper_versions_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_relations` ADD CONSTRAINT `paper_relations_paper_id_old_fkey` FOREIGN KEY (`paper_id_old`) REFERENCES `papers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_relations` ADD CONSTRAINT `paper_relations_paper_id_new_fkey` FOREIGN KEY (`paper_id_new`) REFERENCES `papers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `relevance_scores` ADD CONSTRAINT `relevance_scores_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_policy_tags` ADD CONSTRAINT `paper_policy_tags_paper_id_fkey` FOREIGN KEY (`paper_id`) REFERENCES `papers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `paper_policy_tags` ADD CONSTRAINT `paper_policy_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `policy_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

