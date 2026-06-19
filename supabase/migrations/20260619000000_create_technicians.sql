create table if not exists technicians (
  id uuid references auth.users(id) primary key,
  first_name text,
  last_name text,
  email text,
  phone text,
  qualification text,
  experience int default 0,
  registration_number text,
  document_url text,
  status text default 'pending',
  flagged boolean default false,
  flag_reason text,
  flagged_by text,
  created_at timestamptz default now()
);

grant all on technicians to anon, authenticated;
