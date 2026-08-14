-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Origin" AS ENUM ('local', 'international');

-- CreateEnum
CREATE TYPE "SourceTier" AS ENUM ('tier_1', 'tier_2', 'tier_3');

-- CreateEnum
CREATE TYPE "MetadataStatus" AS ENUM ('indexed', 'queued_review', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "AbstractPolicy" AS ENUM ('full', 'summary_only', 'link_only');

-- CreateEnum
CREATE TYPE "SummaryStatus" AS ENUM ('draft', 'in_review', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "SummarySource" AS ENUM ('manual', 'ai_draft', 'ai_reviewed');

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('from_abstract', 'from_fulltext');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('id', 'en');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('superseded_by', 'follow_up_same_author', 'related_semantic', 'contradicted_by', 'extended_by');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('suggested', 'approved', 'rejected', 'disputed');

-- CreateEnum
CREATE TYPE "RelevanceStatus" AS ENUM ('too_new_to_score', 'still_relevant', 'needs_update', 'superseded', 'retracted');

-- CreateEnum
CREATE TYPE "PublishedRelevance" AS ENUM ('still_relevant', 'needs_update', 'superseded', 'retracted', 'foundational');

-- CreateEnum
CREATE TYPE "RetractionStatus" AS ENUM ('none', 'retracted', 'expression_of_concern');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'editor', 'contributor', 'reader');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('conference', 'journal', 'preprint_repo', 'repository');

-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('suggested', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'in_review', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('queued', 'in_review', 'approved', 'rejected_spam', 'rejected_predatory', 'rejected_duplicate', 'rejected_no_credentials');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('doi', 'arxiv_id', 'openreview_id', 'openalex_id', 'oai_identifier', 'semantic_scholar_id');

-- CreateEnum
CREATE TYPE "License" AS ENUM ('cc_by', 'cc_by_sa', 'cc_by_nc', 'cc_by_nc_sa', 'cc0', 'other_open', 'restricted', 'unknown');

-- CreateEnum
CREATE TYPE "EnrichmentStatus" AS ENUM ('pending', 'enriched_openalex', 'no_doi', 'not_found_openalex', 'failed');

-- CreateTable
CREATE TABLE "papers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_lang" TEXT,
    "abstract_raw" TEXT,
    "abstract_display_policy" "AbstractPolicy" NOT NULL DEFAULT 'summary_only',
    "published_date" DATE,
    "language" TEXT,
    "origin" "Origin" NOT NULL,
    "venue_id" TEXT,
    "venue_name_raw" TEXT,
    "venue_country" TEXT,
    "affiliation_countries" TEXT[],
    "source_tier" "SourceTier" NOT NULL DEFAULT 'tier_3',
    "tier_reason" TEXT,
    "is_foundational" BOOLEAN NOT NULL DEFAULT false,
    "metadata_status" "MetadataStatus" NOT NULL DEFAULT 'indexed',
    "inclusion_basis" TEXT,
    "canonical_url" TEXT,
    "license_raw" TEXT,
    "license_normalized" "License" NOT NULL DEFAULT 'unknown',
    "affiliation_inferred" BOOLEAN NOT NULL DEFAULT false,
    "enrichment_status" "EnrichmentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_titles" (
    "paper_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "paper_titles_pkey" PRIMARY KEY ("paper_id","language")
);

-- CreateTable
CREATE TABLE "paper_identifiers" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "id_type" "IdType" NOT NULL,
    "id_value" TEXT NOT NULL,

    CONSTRAINT "paper_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_merges" (
    "surviving_id" TEXT NOT NULL,
    "merged_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "merged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_merges_pkey" PRIMARY KEY ("surviving_id","merged_id")
);

-- CreateTable
CREATE TABLE "approved_venues" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "venue_type" "VenueType" NOT NULL,
    "tier" "SourceTier" NOT NULL,
    "ranking_basis" TEXT,
    "openalex_source_id" TEXT,
    "issn_l" TEXT,
    "arxiv_categories" TEXT[],
    "country" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "approved_venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_variants" TEXT[],
    "country" TEXT,
    "institution_type" TEXT,
    "openalex_institution_id" TEXT,
    "ror_id" TEXT,
    "profile_description" TEXT,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orcid_id" TEXT,
    "openalex_author_id" TEXT,

    CONSTRAINT "authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_authors" (
    "paper_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_order" INTEGER NOT NULL,

    CONSTRAINT "paper_authors_pkey" PRIMARY KEY ("paper_id","author_id")
);

-- CreateTable
CREATE TABLE "author_affiliations" (
    "author_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,

    CONSTRAINT "author_affiliations_pkey" PRIMARY KEY ("author_id","institution_id","paper_id")
);

-- CreateTable
CREATE TABLE "paper_topics" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "domain" TEXT,
    "field" TEXT,
    "subfield" TEXT,
    "topic" TEXT,
    "topic_id" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,

    CONSTRAINT "paper_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "language" "Lang" NOT NULL DEFAULT 'id',
    "summary_layperson" TEXT,
    "summary_technical" TEXT,
    "relevance_indonesia" TEXT,
    "source_type" "SummarySource" NOT NULL,
    "provenance" "Provenance" NOT NULL DEFAULT 'from_abstract',
    "status" "SummaryStatus" NOT NULL DEFAULT 'draft',
    "authored_by" TEXT,
    "reviewed_by" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_stats" (
    "paper_id" TEXT NOT NULL,
    "citation_count_total" INTEGER NOT NULL DEFAULT 0,
    "citation_by_year" JSONB,
    "fwci" DOUBLE PRECISION,
    "citation_normalized_percentile" DOUBLE PRECISION,
    "local_percentile" DOUBLE PRECISION,
    "retraction_status" "RetractionStatus" NOT NULL DEFAULT 'none',

    CONSTRAINT "citation_stats_pkey" PRIMARY KEY ("paper_id")
);

-- CreateTable
CREATE TABLE "paper_versions" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "changed_summary" TEXT,
    "version_date" DATE,

    CONSTRAINT "paper_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_relations" (
    "id" TEXT NOT NULL,
    "paper_id_old" TEXT NOT NULL,
    "paper_id_new" TEXT NOT NULL,
    "relation_type" "RelationType" NOT NULL,
    "confidence_score" DOUBLE PRECISION,
    "reasoning_text" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'suggested',

    CONSTRAINT "paper_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relevance_scores" (
    "paper_id" TEXT NOT NULL,
    "computed_score" INTEGER,
    "computed_status" "RelevanceStatus" NOT NULL DEFAULT 'too_new_to_score',
    "computed_reasoning" TEXT,
    "published_status" "PublishedRelevance",
    "published_reasoning" TEXT,
    "override_by" TEXT,
    "override_reason" TEXT,

    CONSTRAINT "relevance_scores_pkey" PRIMARY KEY ("paper_id")
);

-- CreateTable
CREATE TABLE "policy_tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label_id" TEXT NOT NULL,
    "label_en" TEXT,
    "tag_group" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "policy_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_policy_tags" (
    "paper_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "status" "TagStatus" NOT NULL DEFAULT 'suggested',

    CONSTRAINT "paper_policy_tags_pkey" PRIMARY KEY ("paper_id","tag_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "paper_id" TEXT NOT NULL,
    "dispute_type" TEXT NOT NULL,
    "submitted_by_name" TEXT,
    "submitted_by_email" TEXT,
    "argument" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "submitted_by_name" TEXT,
    "submitted_by_email" TEXT NOT NULL,
    "claimed_identifier" TEXT,
    "paper_id" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'queued',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "papers_published_date_idx" ON "papers"("published_date");

-- CreateIndex
CREATE INDEX "papers_origin_idx" ON "papers"("origin");

-- CreateIndex
CREATE INDEX "papers_source_tier_idx" ON "papers"("source_tier");

-- CreateIndex
CREATE INDEX "papers_metadata_status_idx" ON "papers"("metadata_status");

-- CreateIndex
CREATE INDEX "paper_identifiers_paper_id_idx" ON "paper_identifiers"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "paper_identifiers_id_type_id_value_key" ON "paper_identifiers"("id_type", "id_value");

-- CreateIndex
CREATE INDEX "paper_merges_merged_id_idx" ON "paper_merges"("merged_id");

-- CreateIndex
CREATE UNIQUE INDEX "approved_venues_openalex_source_id_key" ON "approved_venues"("openalex_source_id");

-- CreateIndex
CREATE UNIQUE INDEX "approved_venues_issn_l_key" ON "approved_venues"("issn_l");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_openalex_institution_id_key" ON "institutions"("openalex_institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_ror_id_key" ON "institutions"("ror_id");

-- CreateIndex
CREATE INDEX "institutions_country_idx" ON "institutions"("country");

-- CreateIndex
CREATE INDEX "paper_topics_paper_id_idx" ON "paper_topics"("paper_id");

-- CreateIndex
CREATE INDEX "paper_topics_subfield_idx" ON "paper_topics"("subfield");

-- CreateIndex
CREATE INDEX "summaries_paper_id_language_status_idx" ON "summaries"("paper_id", "language", "status");

-- CreateIndex
CREATE UNIQUE INDEX "paper_versions_paper_id_version_number_key" ON "paper_versions"("paper_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "paper_relations_paper_id_old_paper_id_new_relation_type_key" ON "paper_relations"("paper_id_old", "paper_id_new", "relation_type");

-- CreateIndex
CREATE UNIQUE INDEX "policy_tags_slug_key" ON "policy_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "approved_venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_titles" ADD CONSTRAINT "paper_titles_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_identifiers" ADD CONSTRAINT "paper_identifiers_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_merges" ADD CONSTRAINT "paper_merges_surviving_id_fkey" FOREIGN KEY ("surviving_id") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_authors" ADD CONSTRAINT "paper_authors_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_authors" ADD CONSTRAINT "paper_authors_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_affiliations" ADD CONSTRAINT "author_affiliations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "authors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_affiliations" ADD CONSTRAINT "author_affiliations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_affiliations" ADD CONSTRAINT "author_affiliations_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_topics" ADD CONSTRAINT "paper_topics_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "citation_stats" ADD CONSTRAINT "citation_stats_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_versions" ADD CONSTRAINT "paper_versions_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_relations" ADD CONSTRAINT "paper_relations_paper_id_old_fkey" FOREIGN KEY ("paper_id_old") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_relations" ADD CONSTRAINT "paper_relations_paper_id_new_fkey" FOREIGN KEY ("paper_id_new") REFERENCES "papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relevance_scores" ADD CONSTRAINT "relevance_scores_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_policy_tags" ADD CONSTRAINT "paper_policy_tags_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_policy_tags" ADD CONSTRAINT "paper_policy_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "policy_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

