# Graph Report - Prototype  (2026-09-09)

## Corpus Check
- 18 files · ~212,840 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1355 nodes · 2946 edges · 112 communities (79 shown, 10 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 248 edges (avg confidence: 0.92)
- Token cost: 235,677 input · 0 output

## Community Hubs (Navigation)
- Header Detection and Mapping
- Property Reference Resolution
- Right to Erasure
- Leads API
- Lead Model and Stages
- Role Hierarchy Enforcement
- Frontend Dependencies
- Cross-Register Dedup Index
- Jobs API and Error Reporting
- Search Query Construction
- Reprocessing and Engine Version
- Job Runner and Stale Reaping
- Records API and Facets
- Bulk Ingest Scripts
- User Admin and Audit
- Read Cache and Reliability
- Database Session Tuning
- App Shell and Routing
- Ingestion Engine Core
- Contact Verdicts and Edit Audit
- Lead Activity Panel
- Call Queue UI
- UI Primitives and Bento Cards
- JWT Auth and Token Decoding
- Enterprise Hardening Tests
- Developer Reference Canon
- Engine Correctness Tests
- Records Explorer and Bulk Actions
- Executive Dashboard UI
- Validation and Identity Hash
- Analytics and Pipeline Summary
- Auth Schemas and Login
- Worker Claim and Job Status
- Field Cleaning Functions
- Upload Endpoint and Schemas
- Alembic Startup Migrations
- Enrichment Depth Tests
- Alembic Environment
- Job Detail Schemas
- Design System and Lead UX Docs
- Known Issues and Data Integrity
- Brand Icons and Favicon
- Auth Lock and User Management UI
- Dubai Hills Ingest Script
- Number Normalization Tests
- Frontend CI and Visual Tokens
- Project Overview and PDPL
- Caching and Count Ceiling
- Migration CI Gate
- Header Alias Management
- Connection Pool and Export Spooling
- Async Ingest Queue Decisions
- Railway Deploy Config
- Root Package Dependencies
- Frontend Lint Config
- Spatial 3D Visuals
- Trigram Search Acceleration
- Application Settings
- Presigned Upload Plan
- Property Key Extraction
- Name Similarity Matching
- Online Index and Pruning Scripts
- Cache Invalidation and Materialised Views
- Password Hashing
- Normalization Engine Decisions
- Index Gaps and Scale Benchmarks
- Deduplication Keys and Defects
- Scale Benchmark Script
- Direct Ingest CLI
- Job Control Migration
- Upload and Select Controls
- Search Acceleration Migration
- Global Exception Handling
- Size and Bulk-Insert Defects
- Developer Name Cleaning
- Phone Number Cleaning
- Docs and PDF Generation
- SQLite to Postgres Migration
- Vercel Config
- Size and Number Conversion
- Deprecated Trigram Script
- Cost Brief PDF Script
- Lead Test Fixtures
- Root Node Entrypoint
- Vite React Template Readme
- CI Concurrency Control
- Admin Role Constant
- Any Type Placeholder
- Phone Parsing Dependency

## God Nodes (most connected - your core abstractions)
1. `User` - 83 edges
2. `Record` - 67 edges
3. `UserRole` - 49 edges
4. `react` - 42 edges
5. `ProcessingJob` - 37 edges
6. `apiFetch()` - 35 edges
7. `Base` - 31 edges
8. `_get_or_create_lead()` - 29 edges
9. `SourceFile` - 28 edges
10. `Processor` - 27 edges

## Surprising Connections (you probably didn't know these)
- `In-Process LRU Cache Instead of Redis` --semantically_similar_to--> `worker.py Database-Polling Ingest`  [INFERRED] [semantically similar]
  PERFORMANCE_AUDIT.md → CHANGELOG.md
- `test_export_audit_logging()` --uses--> `ExportAuditLog`  [INFERRED]
  tests/test_enterprise_hardening.py → backend/app/models/models.py
- `test_generated_columns_track_updates()` --uses--> `Record`  [INFERRED]
  tests/test_search_acceleration.py → backend/app/models/models.py
- `test_has_valid_mobile_is_computed_by_the_database()` --uses--> `Record`  [INFERRED]
  tests/test_search_acceleration.py → backend/app/models/models.py
- `test_search_text_is_populated_and_lowercased()` --uses--> `Record`  [INFERRED]
  tests/test_search_acceleration.py → backend/app/models/models.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Free-Text Search Performance Chain** — changelog_search_text_generated_column, changelog_gin_trigram_index, performance_audit_random_page_cost_misconfiguration, performance_report_session_planner_tuning, performance_report_count_ceiling_search, test_checklist_trigram_search_performance [INFERRED 0.85]
- **PDPL Compliance Surface** — changelog_do_not_contact_enforcement, changelog_right_to_erasure, changelog_contact_verdicts, project_status_security_and_pdpl, test_checklist_pdpl_erasure, todo_pdpl_data_residency_me_central_1 [INFERRED 0.85]
- **Durable Ingest Migration Path** — changelog_worker_polling_ingest, known_issues_issue_101_local_storage_path, known_issues_dispatch_versus_state_separation, decisions_adr_002_presigned_s3_uploads, decisions_adr_003_amazon_sqs_ingestion_queue, todo_day_8_job_queue, todo_day_14_production_runtime [INFERRED 0.85]

## Communities (112 total, 10 thin omitted)

### Community 0 - "Header Detection and Mapping"
Cohesion: 0.06
Nodes (66): detect_format(), find_header_row(), _known_header_tokens(), _looks_like_data(), _norm_cell(), open_source(), Exception, Path (+58 more)

### Community 1 - "Property Reference Resolution"
Cohesion: 0.06
Nodes (43): _building_key(), _iter_sheets(), _key(), load_property_reference(), _norm_header(), _parse_location(), PropertyFacts, PropertyReference (+35 more)

### Community 2 - "Right to Erasure"
Cohesion: 0.11
Nodes (37): apply_erasures(), erase_record(), ErasureIn, ErasureOut, list_erasures(), BaseModel, get, post (+29 more)

### Community 3 - "Leads API"
Cohesion: 0.09
Nodes (36): ActivityIn, ActivityOut, bulk_queue(), BulkFailure, BulkQueueIn, BulkQueueOut, clear_verdict(), LeadOut (+28 more)

### Community 4 - "Lead Model and Stages"
Cohesion: 0.16
Nodes (35): _get_or_create_lead(), The lead for a record, created on first touch., Lead, LeadStage, Where a lead sits in the sales conversation, not its data quality. Deliberately…, Outreach state for one owner. Created on first contact, not at ingest. Not…, _bulk(), _job() (+27 more)

### Community 5 - "Role Hierarchy Enforcement"
Cohesion: 0.12
Nodes (29): Hide ghost accounts from everyone but another ghost., Fetch a user the viewer is allowed to know exists. A hidden account returns…, Nobody may hand out a role they do not outrank, including their own. Without…, _require_can_grant(), _require_outranks(), _target_or_404(), _visible(), PrivilegedActionAudit (+21 more)

### Community 6 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (33): dependencies, lucide-react, react, react-dom, tailwindcss, @tailwindcss/vite, three, devDependencies (+25 more)

### Community 7 - "Cross-Register Dedup Index"
Cohesion: 0.11
Nodes (23): _chunks(), DedupIndex, NullDedupIndex, Session, Cross-register duplicate lookups against rows already in the database. Dedup…, No-op index. Restores single-file dedup when no database is available., Batch-granularity lookups into the existing corpus. Scoped to a single job's…, Which of these identity hashes are already stored. (+15 more)

### Community 8 - "Jobs API and Error Reporting"
Cohesion: 0.15
Nodes (30): cancel_job(), get_global_errors_summary(), get_job(), get_job_errors(), get_job_errors_aggregate(), inspect_file_endpoint(), _job_out(), list_jobs() (+22 more)

### Community 9 - "Search Query Construction"
Cohesion: 0.11
Nodes (28): build_search_filter(), _escape_like(), has_indexable_token(), _phone_variants(), Free-text search query construction. Replaces the original `ILIKE '%q%'` fan-…, True when at least one token is long enough for the trigram index., Return a SQLAlchemy predicate for a free-text query, or None. Every token must…, Neutralise LIKE metacharacters so user input is matched literally. (+20 more)

### Community 10 - "Reprocessing and Engine Version"
Cohesion: 0.15
Nodes (25): Jobs holding at least one record below the current engine version. Ordered…, _stale_job_ids(), The 23 standard fields + provenance + quality metadata. Every business field is…, Record, RecordStatus, normalize_all_records(), Batch normalization script for existing database records. Normalizes: - Mobile…, test_hardened_record_update_and_audit() (+17 more)

### Community 11 - "Job Runner and Stale Reaping"
Cohesion: 0.11
Nodes (24): Fail jobs whose worker is gone. Called once at startup. A redeploy, OOM kill or…, Process one job. Runs in a FastAPI background task with its own session., reap_stale_jobs(), run_job(), engine_status(), BackgroundTasks, get, post (+16 more)

### Community 12 - "Records API and Facets"
Cohesion: 0.13
Nodes (26): column_mappings(), dashboard_stats(), export_records(), _facet_cache(), filter_options(), get_record(), get_record_audits(), _matview() (+18 more)

### Community 13 - "Bulk Ingest Scripts"
Cohesion: 0.15
Nodes (22): init_db(), SourceFile, Processor, Stateless engine. The caller supplies persistence + progress callbacks., check_disk_safety(), ingest_file(), main(), Path (+14 more)

### Community 14 - "User Admin and Audit"
Cohesion: 0.15
Nodes (25): _audit(), change_own_password(), create_user(), get_me(), list_users(), privileged_audit(), Depends, get (+17 more)

### Community 15 - "Read Cache and Reliability"
Cohesion: 0.13
Nodes (22): list_records(), get_cached_default_count(), get_cached_filters(), Any, In-process thread-safe LRU/TTL cache for local read acceleration. Used for…, Retrieve cached filter options if available and not expired., Store computed filter options in the in-process cache., Retrieve cached exact count for default unfiltered records view. (+14 more)

### Community 16 - "Database Session Tuning"
Cohesion: 0.09
Nodes (6): _postgres_read_session_tuning(), _postgres_session_tuning(), _sqlite_pragmas(), listens_for, Script to safely prune ~75% of source spreadsheets from the local PostgreSQL…, Fast SQL-based database reclassification and phone cleaning script. Performs…

### Community 17 - "App Shell and Routing"
Cohesion: 0.13
Nodes (17): App(), ROUTES, ColumnMappingInspector(), ForcePasswordChange(), submit(), Header(), initials(), ROLE_LABEL (+9 more)

### Community 18 - "Ingestion Engine Core"
Cohesion: 0.12
Nodes (18): Ingestion engine. ENGINE_VERSION identifies the set of cleaning, validation,…, BatchOutcome, Batch processing orchestrator. Flow per the prototype spec: read -> map ->…, clean_filename_community(), _emirate_of(), enrich(), load_reference(), Path (+10 more)

### Community 19 - "Contact Verdicts and Edit Audit"
Cohesion: 0.24
Nodes (21): _build_records_query(), ContactVerdict, What the phone call proved about the data. A salesperson who dials and hears…, RecordEditAudit, parametrize, db(), fixture, Previously CASCADE: reprocessing deleted every hand-correction to a job's rows,… (+13 more)

### Community 20 - "Lead Activity Panel"
Cohesion: 0.15
Nodes (19): ICON_FOR, KINDS, LeadActivityPanel(), clearVerdict(), logActivity(), STAGE_STYLE, STAGES, VERDICTS (+11 more)

### Community 21 - "Call Queue UI"
Cohesion: 0.14
Nodes (13): CallQueue(), dueInfo(), STAGE_CONFIG, num(), RecordInspector(), SECTIONS, SpatialPropertyVisualizer(), SpatialQueueFlow() (+5 more)

### Community 22 - "UI Primitives and Bento Cards"
Cohesion: 0.11
Nodes (3): ToastProvider(), ToastContext, react

### Community 23 - "JWT Auth and Token Decoding"
Cohesion: 0.16
Nodes (19): create_access_token(), decode_access_token(), get_current_user(), get_current_user_optional(), Depends, Request, Session, Enterprise Security and RBAC Authentication Core. Provides: - bcrypt password… (+11 more)

### Community 24 - "Enterprise Hardening Tests"
Cohesion: 0.11
Nodes (15): clean_community(), auth_headers(), fixture, Automated Enterprise Hardening Verification Suite. Tests: 1. JWT…, It created an ADMIN and returned the password to any caller., The records API holds owner names, phone numbers and emails., A bulk endpoint must not be an easier way in than the single one. Everything…, The batch runs in one transaction, so its size has to be bounded. (+7 more)

### Community 25 - "Developer Reference Canon"
Cohesion: 0.18
Nodes (12): _alternation(), canon(), Development, _load_from_json(), _rank(), Load developments from the bundled JSON (used on Railway where xlsx is…, One compiled whole-word alternation over many phrases. Testing each phrase…, # NOTE: match.dev_type is deliberately NOT written to Property (+4 more)

### Community 26 - "Engine Correctness Tests"
Cohesion: 0.12
Nodes (4): _mentions(), Whole-word containment, so "lime" does not match inside "Limestone"., test_column_plan_reports_the_header_feeding_a_target(), test_fallback_matches_whole_words_only()

### Community 27 - "Records Explorer and Bulk Actions"
Cohesion: 0.17
Nodes (11): AddToQueueDialog(), BulkActionBar(), ColumnVisibilityMenu(), ALL_COLUMNS, formatAed(), formatTotal(), PAGE_SIZES, RecordRow (+3 more)

### Community 28 - "Executive Dashboard UI"
Cohesion: 0.20
Nodes (10): ExecutiveDashboard(), STAGE_COLORS, STAGE_LABELS, STAGE_ORDER, JobDetailsView(), LiveProcessingTracker(), PageHeader(), EmptyState() (+2 more)

### Community 29 - "Validation and Identity Hash"
Cohesion: 0.12
Nodes (15): count_populated_fields(), identity_hash(), is_valid_contact(), is_valid_property_context(), json_safe(), Record validation + transformation into the DB row shape. Rules encode the…, Stable identity for dedup. Person + location. Mobile alone is unsafe (shared…, A record has valid real estate property context if: 1. It has a Unit Number,… (+7 more)

### Community 30 - "Analytics and Pipeline Summary"
Cohesion: 0.19
Nodes (14): pipeline_summary(), get, Session, Executive view: who is doing the work, and what it is producing. The CEO, CCO…, The whole desk's pipeline, and what outreach has proved about the data., Per-person activity and pipeline, over a window. Activity is counted over…, team_performance(), ActivityKind (+6 more)

### Community 31 - "Auth Schemas and Login"
Cohesion: 0.21
Nodes (14): ChangePasswordRequest, CreateUserRequest, login(), LoginRequest, BaseModel, Authentication and User Management REST Endpoints., A one-time password, shown once and never stored in the clear., Authenticate user with email & password and return signed JWT. (+6 more)

### Community 32 - "Worker Claim and Job Status"
Cohesion: 0.31
Nodes (13): JobStatus, ProcessingJob, _claim(), db(), fixture, _queued_job(), Only one runner may take a job. run_job is reachable from three places at once:…, The compare-and-set from run_job(). (+5 more)

### Community 33 - "Field Cleaning Functions"
Cohesion: 0.21
Nodes (13): clean_bedroom(), clean_date(), clean_email(), clean_name(), clean_nationality(), clean_party_type(), clean_property_type(), clean_text() (+5 more)

### Community 34 - "Upload Endpoint and Schemas"
Cohesion: 0.23
Nodes (13): BackgroundTasks, Accept an Excel/CSV upload, register it, and (by default) start processing., upload_file(), DashboardStats, ErrorResponse, ORMModel, Page, ProcessingErrorOut (+5 more)

### Community 35 - "Alembic Startup Migrations"
Cohesion: 0.23
Nodes (11): _alembic_config(), current_revision(), _detect_revision(), Run Alembic migrations at startup, including first-time adoption. The database…, Newest revision whose schema marker is already present, or None., Record that the database already matches the newest revision. For a schema…, Bring the database up to the latest revision. Safe to call repeatedly., stamp_head() (+3 more)

### Community 36 - "Enrichment Depth Tests"
Cohesion: 0.35
Nodes (12): _enrich(), _fields(), Enrichment must fill more, and never fill wrongly. Coverage is worth nothing if…, _ref_with(), test_a_generic_trailing_word_does_not_pick_a_developer(), test_an_unknown_place_enriches_nothing(), test_community_is_filled_from_the_development_not_its_region(), test_enrichment_is_recorded_on_every_filled_field() (+4 more)

### Community 37 - "Alembic Environment"
Cohesion: 0.19
Nodes (9): Alembic environment. The database URL is taken from the application settings…, run_migrations_offline(), _url(), Base, datetime, utcnow(), DeclarativeBase, db() (+1 more)

### Community 38 - "Job Detail Schemas"
Cohesion: 0.23
Nodes (5): JobDetail, JobOut, datetime, RecordOut, computed_field

### Community 39 - "Design System and Lead UX Docs"
Cohesion: 0.17
Nodes (13): Call Queue, Contact Verdicts, Leads and Append-Only Activity Log, Records Table Not Keyboard Navigable, AppShell Component Hierarchy, DataTable Data Surface, RecordInspector Split-View Panel, Responsive Breakpoint Rules (+5 more)

### Community 40 - "Known Issues and Data Integrity"
Cohesion: 0.18
Nodes (12): CI Backend Tests Job, engine_version and Reprocessing, record_edits_audit No Longer Cascades, PRAGMA foreign_keys=ON for SQLite, Glacier Lifecycle Conflicts With Reprocessing, ISSUE-101: stored_path Is a Local Filesystem Path, Scheme-Qualified stored_path URI, Storage Layer (Prototype, Local Disk) (+4 more)

### Community 41 - "Brand Icons and Favicon"
Cohesion: 0.20
Nodes (12): Masked Gradient Glow Layers, Favicon Vite Logo Mark, Bluesky Icon, Discord Icon, Documentation Icon, GitHub Icon, Social Icon, SVG Symbol Sprite Sheet (+4 more)

### Community 42 - "Auth Lock and User Management UI"
Cohesion: 0.26
Nodes (9): AuthLockScreen(), grantable(), RANK, ROLE_STYLE, ROLES, setSession(), COMPANY_DOMAIN, EMAIL_PLACEHOLDER (+1 more)

### Community 43 - "Dubai Hills Ingest Script"
Cohesion: 0.27
Nodes (11): bulk_insert_records(), insert_errors(), insert_job(), insert_source_file(), main(), pg_connect(), Path, Batch-process all Dubai Hills XLSX files directly into Supabase. Steps: 1.… (+3 more)

### Community 45 - "Frontend CI and Visual Tokens"
Cohesion: 0.20
Nodes (11): CI Frontend Lint and Build Job, ADR 005: CloudFront CDN + S3 for React SPA, Vite SPA Entrypoint (#root), Bento UI Modular Blocks, Semantic Color Tokens, 5-Tier Elevation Architecture, Flat Design for Operational Data Surfaces, Glassmorphism and Liquid Glass Surfaces (+3 more)

### Community 46 - "Project Overview and PDPL"
Cohesion: 0.18
Nodes (11): Duplicate column_mapping.json Copies, Property Type Enrichment from Portal Data, Right to Erasure, Security & PDPL Baseline, API Endpoint Reference, Batch Studio and Header Remapping, DataLink Engine Platform, RBAC Roles and Export Flag (+3 more)

### Community 47 - "Caching and Count Ceiling"
Cohesion: 0.27
Nodes (10): cachetools Dependency, Row Count Ceiling of 20,000, has_valid_mobile Stored Generated Column, Materialised Views for Facets and Dashboard Aggregates, In-Process LRU Cache Instead of Redis, Pagination Total Count Overhead, Cached Exact Default Count, COUNT_CEILING_SEARCH = 5,000 (+2 more)

### Community 48 - "Migration CI Gate"
Cohesion: 0.22
Nodes (9): Migration Rollback and Re-apply Gate, CI Migrations Against PostgreSQL Job, alembic Dependency, NULLS LAST Primary Key Index Invalidation, Alembic Head a7b4e9f1c260, Alembic Migrations Applied on Startup, httpx for fastapi.testclient, pytest Test Runner (+1 more)

### Community 49 - "Header Alias Management"
Cohesion: 0.25
Nodes (9): add_alias(), delete, post, Save updated mapping config to disk and reload in-memory engine structures., Add a new custom header alias for a target field and persist permanently., Remove a custom header alias permanently., remove_alias(), _sync_alias_files() (+1 more)

### Community 50 - "Connection Pool and Export Spooling"
Cohesion: 0.22
Nodes (9): openpyxl Dependency, Reduced Connection Pool Defaults, DO_NOT_CONTACT Enforcement, ADR 004: Aurora Serverless v2 with RDS Proxy, Connection Pool Starvation Risk, Export Spooling and Pool Decoupling, Localhost-Only Privacy Posture, Lead Suppression Anti-Join (+1 more)

### Community 51 - "Async Ingest Queue Decisions"
Cohesion: 0.33
Nodes (9): worker.py Database-Polling Ingest, ADR 003: Amazon SQS Decoupled Ingestion Queue, DEF-004: Stale Jobs Hung on Restart, Dispatch and State Are Separate Concerns, ISSUE-102: Worker Polling Cost, Async Processing (Prototype, DB Polling), SQS Job Queue Check, Day 11: Job Reliability and Duplicate Protection (+1 more)

### Community 52 - "Railway Deploy Config"
Cohesion: 0.22
Nodes (8): build, builder, dockerfilePath, deploy, restartPolicyMaxRetries, restartPolicyType, startCommand, $schema

### Community 53 - "Root Package Dependencies"
Cohesion: 0.25
Nodes (7): ai, dependencies, ai, @supabase/ssr, @supabase/supabase-js, @supabase/ssr, @supabase/supabase-js

### Community 54 - "Frontend Lint Config"
Cohesion: 0.25
Nodes (7): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema, oxc, warn

### Community 55 - "Spatial 3D Visuals"
Cohesion: 0.32
Nodes (5): DataLinkLogo(), OverviewDashboard(), BASE_NODES, CONNECTIONS, DataTopology3D()

### Community 56 - "Trigram Search Acceleration"
Cohesion: 0.33
Nodes (7): Advisory alembic check Step, GIN Trigram Index on search_text, search_text Generated Column, Free-Text Search Bottleneck (15.7s), random_page_cost Misconfiguration for NVMe, Session random_page_cost and work_mem Tuning, Trigram Search Performance Check

### Community 57 - "Application Settings"
Cohesion: 0.33
Nodes (5): _finalise(), Central configuration. All values overridable via .env / environment., Validate the settings that must not be wrong in production., Settings, BaseSettings

### Community 58 - "Presigned Upload Plan"
Cohesion: 0.33
Nodes (7): ADR 002: Direct-to-S3 Presigned Uploads, ISSUE-103: Multipart Upload Through the API Process, Presigned Uploads and content_sha256, Presigned URL Generation Check, 23-Day Production Master Plan, Day 14: Container and Production Runtime, Day 15: Frontend Upload Integration

### Community 59 - "Property Key Extraction"
Cohesion: 0.33
Nodes (6): extract_property_key(), _first_nonblank(), Any, Fuzzy Deduplication and Near-Duplicate Resolution Engine. Uses standard library…, Generate compound property location key (Community + Unit/Plot). MUST produce…, test_property_key_extraction()

### Community 60 - "Name Similarity Matching"
Cohesion: 0.29
Nodes (6): calculate_name_similarity(), normalize_name_tokens(), Normalize, expand contractions, and sort name tokens to maximize fuzzy match…, Calculate string similarity ratio between two names (0.0 to 1.0)., Resolve duplicate status for a whole batch, then hand back the rows.…, test_fuzzy_name_normalization_and_similarity()

### Community 62 - "Online Index and Pruning Scripts"
Cohesion: 0.33
Nodes (5): _facet_view_sql(), main(), Apply migration 9c41ab7de205 to a large PostgreSQL table without downtime.…, Script to prune spreadsheets down to ~6.37M records (leaving 25% of data, 75%…, run()

### Community 63 - "Cache Invalidation and Materialised Views"
Cohesion: 0.40
Nodes (5): invalidate_filters_cache(), Explicitly purge cached filter options and counts upon ingestion or record…, Refresh of the cached aggregates that back the dashboard. `mv_record_facets`…, Rebuild the dashboard materialised views. Returns True if all refreshed. Never…, refresh_dashboard_caches()

### Community 64 - "Password Hashing"
Cohesion: 0.33
Nodes (6): hash_password(), Hash a plaintext password with bcrypt and unique salt., Verify plaintext password against bcrypt hash., verify_password(), test_bcrypt_hashing(), test_a_password_is_never_stored_in_the_clear()

### Community 65 - "Normalization Engine Decisions"
Cohesion: 0.40
Nodes (6): phonenumbers Dependency, Developer Canonicalisation, ADR 001: Preserve Core Normalization Engine As-Is, Core Normalization Engine (Stable), Cleaning Engine, Developer Reference Resolver

### Community 66 - "Index Gaps and Scale Benchmarks"
Cohesion: 0.33
Nodes (6): scripts/benchmark_scale.py, Unindexed Sortable Columns, Composite Index Gaps for Filtering, Phase 4 Architecture Review Verdict, idx_records_comm_id Partial Composite Index, Do Not Raise shared_buffers on This Machine

### Community 67 - "Deduplication Keys and Defects"
Cohesion: 0.33
Nodes (6): DedupIndex Cross-Register Deduplication, identity_hash, Numbered Community Collapse Defect, property_key Generated Blocking Key, idx_leads_suppressed_identity_hash, Deduplication Tiers Check

### Community 68 - "Scale Benchmark Script"
Cohesion: 0.53
Nodes (5): bench(), _connect(), main(), Insert `total` rows server-side, in batches so progress is visible., seed()

### Community 69 - "Direct Ingest CLI"
Cohesion: 0.53
Nodes (5): ingest_file(), main(), Path, Direct Ingestion CLI Script Processes and ingests all Excel/CSV files directly…, sha256_file()

### Community 70 - "Job Control Migration"
Cohesion: 0.50
Nodes (3): _job_fk_name(), Actual name of the records.job_id foreign key in this database. Autogenerate…, upgrade()

### Community 71 - "Upload and Select Controls"
Cohesion: 0.60
Nodes (3): CustomSelect(), norm(), UploadSection()

### Community 73 - "Global Exception Handling"
Cohesion: 0.50
Nodes (4): Exception, Request, unhandled(), exception_handler

### Community 74 - "Size and Bulk-Insert Defects"
Cohesion: 0.50
Nodes (4): clean_size Header Unit Defect, DEF-005: Overlength plot_reg_no Bulk-Insert Failure, Size Conversion Check, Worker Isolation Check

### Community 75 - "Developer Name Cleaning"
Cohesion: 0.50
Nodes (4): clean_developer(), _developer_key(), Reduce a developer string to its brand token for canonical lookup., Canonicalise a developer name, or None when the value names no builder. Unknown…

### Community 76 - "Phone Number Cleaning"
Cohesion: 0.50
Nodes (4): clean_phone(), clean_phones_multi(), Extract and normalize all phone numbers from a value (which may contain…, Return (E.164-ish normalized number, flag). Handles the defects the audit…

### Community 77 - "Docs and PDF Generation"
Cohesion: 0.50
Nodes (3): generate_pdf_from_markdown(), Path, Generate comprehensive, beautifully styled PDF documentation and organize all…

### Community 78 - "SQLite to Postgres Migration"
Cohesion: 0.67
Nodes (3): main(), Universal and robust migration script from local.db (SQLite) to PostgreSQL…, sync_table()

### Community 79 - "Vercel Config"
Cohesion: 0.50
Nodes (3): builds, routes, version

### Community 90 - "Size and Number Conversion"
Cohesion: 0.67
Nodes (3): clean_number(), clean_size(), Clean size number, automatically converting Sqm (m2) to Sq.Ft (1 m2 = 10.76391…

### Community 93 - "Lead Test Fixtures"
Cohesion: 0.67
Nodes (3): db(), fixture, user()

## Ambiguous Edges - Review These
- `ADR 004: Aurora Serverless v2 with RDS Proxy` → `Localhost-Only Privacy Posture`  [AMBIGUOUS]
  PERFORMANCE_REPORT.md · relation: conceptually_related_to
- `SVG Symbol Sprite Sheet` → `Dark Particle Sphere Wallpaper`  [AMBIGUOUS]
  frontend/public/wallpaper.jpg · relation: conceptually_related_to

## Knowledge Gaps
- **99 isolated node(s):** `BatchOutcome`, `ROUTES`, `ROLE_LABEL`, `GROUPS`, `RANK` (+94 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 495 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ADR 004: Aurora Serverless v2 with RDS Proxy` and `Localhost-Only Privacy Posture`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `SVG Symbol Sprite Sheet` and `Dark Particle Sphere Wallpaper`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `User` connect `Jobs API and Error Reporting` to `Right to Erasure`, `Leads API`, `Lead Model and Stages`, `Role Hierarchy Enforcement`, `Job Runner and Stale Reaping`, `Records API and Facets`, `Bulk Ingest Scripts`, `User Admin and Audit`, `Read Cache and Reliability`, `Contact Verdicts and Edit Audit`, `JWT Auth and Token Decoding`, `Enterprise Hardening Tests`, `Analytics and Pipeline Summary`, `Auth Schemas and Login`, `Upload Endpoint and Schemas`, `Alembic Startup Migrations`, `Alembic Environment`, `Header Alias Management`, `Lead Test Fixtures`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `Record` connect `Reprocessing and Engine Version` to `Right to Erasure`, `Leads API`, `Lead Model and Stages`, `Alembic Environment`, `Direct Ingest CLI`, `Cross-Register Dedup Index`, `Jobs API and Error Reporting`, `Search Query Construction`, `Job Runner and Stale Reaping`, `Records API and Facets`, `Bulk Ingest Scripts`, `Read Cache and Reliability`, `Contact Verdicts and Edit Audit`, `Enterprise Hardening Tests`, `Analytics and Pipeline Summary`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `Processor` connect `Bulk Ingest Scripts` to `Header Detection and Mapping`, `Property Reference Resolution`, `Direct Ingest CLI`, `Cross-Register Dedup Index`, `Jobs API and Error Reporting`, `Reprocessing and Engine Version`, `Job Runner and Stale Reaping`, `Dubai Hills Ingest Script`, `Ingestion Engine Core`, `Name Similarity Matching`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `User` (e.g. with `_audit()` and `change_own_password()`) actually correct?**
  _`User` has 23 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `Record` (e.g. with `ingest_file()` and `main()`) actually correct?**
  _`Record` has 34 INFERRED edges - model-reasoned connections that need verification._