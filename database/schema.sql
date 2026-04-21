-- ================================================================
--  CodeReview AI Platform — Full Database Schema
--  Run this in Supabase SQL Editor (or any PostgreSQL ≥ 14)
-- ================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Drop existing (safe re-run) ────────────────────────────────
drop table if exists review_issues  cascade;
drop table if exists code_reviews   cascade;
drop table if exists employees      cascade;

-- ─── Employees ───────────────────────────────────────────────────
create table employees (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  email         text unique not null,
  password_hash text not null,
  role          text not null default 'developer'
                  check (role in ('admin','lead','developer')),
  job_title     text,
  department    text,
  avatar        text,           -- 2-char initials e.g. "MJ"
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── Code Reviews ────────────────────────────────────────────────
create table code_reviews (
  id                uuid primary key default uuid_generate_v4(),
  employee_id       uuid not null references employees(id) on delete cascade,
  reviewed_by       uuid references employees(id),
  language          text not null,
  code_snippet      text,
  severity_score    numeric(4,1) not null check (severity_score between 1 and 10),
  severity_label    text not null check (severity_label in ('critical','high','medium','low')),
  confidence        text check (confidence in ('High','Medium','Low')),
  summary           text,
  security_count    int not null default 0,
  performance_count int not null default 0,
  quality_count     int not null default 0,
  improved_snippet  text,
  created_at        timestamptz default now()
);

-- ─── Review Issues ───────────────────────────────────────────────
create table review_issues (
  id          uuid primary key default uuid_generate_v4(),
  review_id   uuid not null references code_reviews(id) on delete cascade,
  category    text not null check (category in ('security','performance','quality','naming_design')),
  description text not null,
  created_at  timestamptz default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────
create index on employees(email);
create index on code_reviews(employee_id);
create index on code_reviews(created_at desc);
create index on code_reviews(severity_label);
create index on review_issues(review_id);

-- ─── Auto-update updated_at ──────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_employees_updated_at
  before update on employees
  for each row execute procedure set_updated_at();

-- ─── Views ───────────────────────────────────────────────────────

create or replace view employee_latest_score as
select distinct on (employee_id)
  employee_id, severity_score, severity_label, created_at
from code_reviews
order by employee_id, created_at desc;

create or replace view employee_monthly_avg as
select
  employee_id,
  date_trunc('month', created_at)              as month,
  round(avg(severity_score)::numeric, 1)       as avg_score,
  count(*)::int                                as review_count,
  sum(security_count)::int                     as total_security,
  sum(performance_count)::int                  as total_performance,
  sum(quality_count)::int                      as total_quality
from code_reviews
group by employee_id, date_trunc('month', created_at)
order by month desc;

-- ─── Row Level Security ───────────────────────────────────────────
alter table employees    enable row level security;
alter table code_reviews enable row level security;
alter table review_issues enable row level security;

-- Authenticated users can read everything (JWT handled by backend)
create policy "all select employees"
  on employees for select using (true);
create policy "all select reviews"
  on code_reviews for select using (true);
create policy "all select issues"
  on review_issues for select using (true);
create policy "all insert reviews"
  on code_reviews for insert with check (true);
create policy "all insert issues"
  on review_issues for insert with check (true);
create policy "all delete reviews"
  on code_reviews for delete using (true);

-- ─── Seed: Demo Employees ────────────────────────────────────────
-- Passwords are bcrypt hashes of the plaintext shown in comments
-- admin123   → admin@company.com
-- dev123     → dev@company.com / marcus@company.com
-- lead123    → lead@company.com

insert into employees (name, email, password_hash, role, job_title, department, avatar) values
(
  'Sarah Chen', 'admin@company.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6o4FeSQMKa',
  'admin', 'Engineering Manager', 'Leadership', 'SC'
),
(
  'Marcus Johnson', 'dev@company.com',
  '$2a$12$ixuJqJJH/3q0vz3gvsuvnuHPXRTxT6S7oV6HM8bEFIE0vwEv2TjfC',
  'developer', 'Senior Backend Dev', 'Backend', 'MJ'
),
(
  'Priya Sharma', 'lead@company.com',
  '$2a$12$lDFkpZ1dYCp5LXQHB8D6VOmOZm1J9kHPzWQnUNivVqOQyBHGAVSIe',
  'lead', 'Tech Lead', 'Full Stack', 'PS'
),
(
  'Aisha Patel', 'aisha@company.com',
  '$2a$12$ixuJqJJH/3q0vz3gvsuvnuHPXRTxT6S7oV6HM8bEFIE0vwEv2TjfC',
  'developer', 'Mid Frontend Dev', 'Frontend', 'AP'
),
(
  'Ravi Kumar', 'ravi@company.com',
  '$2a$12$ixuJqJJH/3q0vz3gvsuvnuHPXRTxT6S7oV6HM8bEFIE0vwEv2TjfC',
  'developer', 'Junior Backend Dev', 'Backend', 'RK'
),
(
  'Elena Torres', 'elena@company.com',
  '$2a$12$ixuJqJJH/3q0vz3gvsuvnuHPXRTxT6S7oV6HM8bEFIE0vwEv2TjfC',
  'developer', 'Senior Full Stack Dev', 'Full Stack', 'ET'
),
(
  'Daniel Park', 'daniel@company.com',
  '$2a$12$ixuJqJJH/3q0vz3gvsuvnuHPXRTxT6S7oV6HM8bEFIE0vwEv2TjfC',
  'developer', 'Junior Frontend Dev', 'Frontend', 'DP'
);
