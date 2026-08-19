-- MariaDB dump 10.19  Distrib 10.4.24-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: pusatriset
-- ------------------------------------------------------
-- Server version	10.4.24-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `app_settings` (
  `key` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `updated_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `approved_venues`
--

DROP TABLE IF EXISTS `approved_venues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `approved_venues` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `venue_type` enum('conference','journal','preprint_repo','repository') COLLATE utf8mb4_unicode_ci NOT NULL,
  `tier` enum('tier_1','tier_2','tier_3') COLLATE utf8mb4_unicode_ci NOT NULL,
  `ranking_basis` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `openalex_source_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `issn_l` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `approved_venues_openalex_source_id_key` (`openalex_source_id`),
  UNIQUE KEY `approved_venues_issn_l_key` (`issn_l`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `author_affiliations`
--

DROP TABLE IF EXISTS `author_affiliations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `author_affiliations` (
  `author_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `institution_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`author_id`,`institution_id`,`paper_id`),
  KEY `author_affiliations_institution_id_idx` (`institution_id`),
  KEY `author_affiliations_paper_id_idx` (`paper_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `authors`
--

DROP TABLE IF EXISTS `authors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `authors` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orcid_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `openalex_author_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `citation_stats`
--

DROP TABLE IF EXISTS `citation_stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `citation_stats` (
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `citation_count_total` int(11) NOT NULL DEFAULT 0,
  `citation_by_year` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`citation_by_year`)),
  `fwci` double DEFAULT NULL,
  `citation_normalized_percentile` double DEFAULT NULL,
  `local_percentile` double DEFAULT NULL,
  `retraction_status` enum('none','retracted','expression_of_concern') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  PRIMARY KEY (`paper_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `disputes`
--

DROP TABLE IF EXISTS `disputes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `disputes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dispute_type` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_by_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submitted_by_email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `argument` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('open','in_review','accepted','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `resolution` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `institution_name_variants`
--

DROP TABLE IF EXISTS `institution_name_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `institution_name_variants` (
  `institution_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`institution_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `institutions`
--

DROP TABLE IF EXISTS `institutions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `institutions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `institution_type` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `openalex_institution_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ror_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `profile_description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `institutions_openalex_institution_id_key` (`openalex_institution_id`),
  UNIQUE KEY `institutions_ror_id_key` (`ror_id`),
  KEY `institutions_country_idx` (`country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_affiliation_countries`
--

DROP TABLE IF EXISTS `paper_affiliation_countries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_affiliation_countries` (
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country_code` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`paper_id`,`country_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_authors`
--

DROP TABLE IF EXISTS `paper_authors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_authors` (
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_order` int(11) NOT NULL,
  PRIMARY KEY (`paper_id`,`author_id`),
  KEY `paper_authors_author_id_idx` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_identifiers`
--

DROP TABLE IF EXISTS `paper_identifiers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_identifiers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_type` enum('doi','arxiv_id','openreview_id','openalex_id','oai_identifier','semantic_scholar_id') COLLATE utf8mb4_unicode_ci NOT NULL,
  `id_value` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paper_identifiers_id_type_id_value_key` (`id_type`,`id_value`),
  KEY `paper_identifiers_paper_id_idx` (`paper_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_merges`
--

DROP TABLE IF EXISTS `paper_merges`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_merges` (
  `surviving_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `merged_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `method` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `merged_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`surviving_id`,`merged_id`),
  KEY `paper_merges_merged_id_idx` (`merged_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_policy_tags`
--

DROP TABLE IF EXISTS `paper_policy_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_policy_tags` (
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('suggested','published','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'suggested',
  PRIMARY KEY (`paper_id`,`tag_id`),
  KEY `paper_policy_tags_tag_id_idx` (`tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_relations`
--

DROP TABLE IF EXISTS `paper_relations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_relations` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id_old` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id_new` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `relation_type` enum('superseded_by','follow_up_same_author','related_semantic','contradicted_by','extended_by') COLLATE utf8mb4_unicode_ci NOT NULL,
  `confidence_score` double DEFAULT NULL,
  `reasoning_text` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('suggested','approved','rejected','disputed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'suggested',
  PRIMARY KEY (`id`),
  UNIQUE KEY `paper_relations_paper_id_old_paper_id_new_relation_type_key` (`paper_id_old`,`paper_id_new`,`relation_type`),
  KEY `paper_relations_paper_id_new_idx` (`paper_id_new`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_titles`
--

DROP TABLE IF EXISTS `paper_titles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_titles` (
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`paper_id`,`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_topics`
--

DROP TABLE IF EXISTS `paper_topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_topics` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `domain` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `field` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subfield` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `topic` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `topic_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `score` double DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `paper_topics_paper_id_idx` (`paper_id`),
  KEY `paper_topics_subfield_idx` (`subfield`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `paper_versions`
--

DROP TABLE IF EXISTS `paper_versions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `paper_versions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version_number` int(11) NOT NULL,
  `changed_summary` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paper_versions_paper_id_version_number_key` (`paper_id`,`version_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `papers`
--

DROP TABLE IF EXISTS `papers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `papers` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_lang` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `abstract_raw` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `abstract_display_policy` enum('full','summary_only','link_only') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'summary_only',
  `published_date` date DEFAULT NULL,
  `language` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `origin` enum('local','international') COLLATE utf8mb4_unicode_ci NOT NULL,
  `venue_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `venue_name_raw` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `venue_country` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_tier` enum('tier_1','tier_2','tier_3') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'tier_3',
  `tier_reason` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_foundational` tinyint(1) NOT NULL DEFAULT 0,
  `metadata_status` enum('indexed','queued_review','rejected','withdrawn') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'indexed',
  `inclusion_basis` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `canonical_url` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_raw` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `license_normalized` enum('cc_by','cc_by_sa','cc_by_nc','cc_by_nc_sa','cc0','other_open','restricted','unknown') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unknown',
  `affiliation_inferred` tinyint(1) NOT NULL DEFAULT 0,
  `enrichment_status` enum('pending','enriched_openalex','no_doi','not_found_openalex','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `priority_pinned_at` datetime(3) DEFAULT NULL,
  `issn_l` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sjr_quartile` enum('q1','q2','q3','q4','unindexed') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sjr_score` double DEFAULT NULL,
  `sjr_year` int(11) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `papers_published_date_idx` (`published_date`),
  KEY `papers_metadata_status_published_date_idx` (`metadata_status`,`published_date`),
  KEY `papers_origin_idx` (`origin`),
  KEY `papers_source_tier_idx` (`source_tier`),
  KEY `papers_metadata_status_idx` (`metadata_status`),
  KEY `papers_venue_id_idx` (`venue_id`),
  KEY `papers_priority_pinned_at_idx` (`priority_pinned_at`),
  KEY `papers_sjr_quartile_idx` (`sjr_quartile`),
  KEY `papers_issn_l_idx` (`issn_l`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `policy_tags`
--

DROP TABLE IF EXISTS `policy_tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `policy_tags` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `label_en` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tag_group` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `policy_tags_slug_key` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `relevance_scores`
--

DROP TABLE IF EXISTS `relevance_scores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `relevance_scores` (
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `computed_score` int(11) DEFAULT NULL,
  `computed_status` enum('too_new_to_score','still_relevant','needs_update','superseded','retracted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'too_new_to_score',
  `computed_reasoning` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `published_status` enum('still_relevant','needs_update','superseded','retracted','foundational') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `published_reasoning` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `override_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `override_reason` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`paper_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `submissions`
--

DROP TABLE IF EXISTS `submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `submissions` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_by_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `submitted_by_email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `claimed_identifier` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('queued','in_review','approved','rejected_spam','rejected_predatory','rejected_duplicate','rejected_no_credentials') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'queued',
  `submitted_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `summaries`
--

DROP TABLE IF EXISTS `summaries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `summaries` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `paper_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` enum('id','en') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'id',
  `content` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` enum('manual','ai_draft','ai_reviewed') COLLATE utf8mb4_unicode_ci NOT NULL,
  `provenance` enum('from_abstract','from_fulltext') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'from_abstract',
  `status` enum('draft','in_review','published','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `authored_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reviewed_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `summaries_paper_id_language_status_idx` (`paper_id`,`language`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('admin','editor','contributor','reader') COLLATE utf8mb4_unicode_ci NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `venue_arxiv_categories`
--

DROP TABLE IF EXISTS `venue_arxiv_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `venue_arxiv_categories` (
  `venue_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`venue_id`,`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping routines for database 'pusatriset'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-19 15:15:39
