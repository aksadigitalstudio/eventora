-- Run once on a fresh Supabase project. Event content is initialized from src/config.ts,
-- by an authenticated organizer; this schema does not duplicate the supplied configuration.
create table public.events(id uuid primary key, data jsonb not null, created_at timestamptz not null default now(), check(data->>'id'=id::text));
-- Provision authorized creator UUIDs through the Supabase SQL editor, never the browser.
create table public.organizer_accounts(user_id uuid primary key references auth.users on delete cascade);
alter table public.organizer_accounts enable row level security;
revoke all on public.organizer_accounts from anon,authenticated;
create table public.event_members(event_id uuid references public.events on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('admin','staff')), primary key(event_id,user_id));
create table public.ticket_categories(id uuid primary key,event_id uuid not null references public.events,data jsonb not null,capacity integer generated always as ((data->>'capacity')::integer) stored,price bigint generated always as ((data->>'price')::bigint) stored,unique(id,event_id),check(capacity>=0 and capacity<=100000),check(price>=0),check(data->>'id'=id::text),check(length(data->>'name') between 1 and 100));
create table public.registrations(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events,category_id uuid not null,token uuid not null unique default gen_random_uuid(),request_id uuid not null,number text not null,email text not null,name text not null,details jsonb not null default '{}',created_at timestamptz not null default now(),unique(event_id,request_id),unique(event_id,number),unique(event_id,email),unique(id,event_id),foreign key(category_id,event_id) references public.ticket_categories(id,event_id),check(length(name) between 2 and 100),check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
create table public.checkins(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events,registration_id uuid not null unique,created_at timestamptz not null default now(),method text not null check(method in ('QR','manual')),actor uuid not null references auth.users,foreign key(registration_id,event_id) references public.registrations(id,event_id));
create table public.checkin_audit(id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events,registration_id uuid not null,created_at timestamptz not null default now(),action text not null,actor uuid not null references auth.users,reason text not null default '',foreign key(registration_id,event_id) references public.registrations(id,event_id));
create table public.registration_sequences(event_id uuid not null references public.events,day date not null,value integer not null default 0,primary key(event_id,day));
create index registrations_event_category on public.registrations(event_id,category_id);
create index checkins_event_time on public.checkins(event_id,created_at);

create function public.is_event_staff(p_event uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.event_members where event_id=p_event and user_id=auth.uid())$$;
create function public.is_event_admin(p_event uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.event_members where event_id=p_event and user_id=auth.uid() and role='admin')$$;
revoke all on function public.is_event_staff(uuid),public.is_event_admin(uuid) from public;grant execute on function public.is_event_staff(uuid),public.is_event_admin(uuid) to authenticated;
alter table public.events enable row level security;alter table public.event_members enable row level security;alter table public.ticket_categories enable row level security;alter table public.registrations enable row level security;alter table public.checkins enable row level security;alter table public.checkin_audit enable row level security;alter table public.registration_sequences enable row level security;
create policy staff_event_read on public.events for select to authenticated using(public.is_event_staff(id));
create policy own_membership on public.event_members for select to authenticated using(user_id=auth.uid());
create policy staff_categories_read on public.ticket_categories for select to authenticated using(public.is_event_staff(event_id));
create policy staff_registrations_read on public.registrations for select to authenticated using(public.is_event_staff(event_id));
create policy staff_checkins_read on public.checkins for select to authenticated using(public.is_event_staff(event_id));
create policy staff_audit_read on public.checkin_audit for select to authenticated using(public.is_event_staff(event_id));
revoke all on public.events,public.event_members,public.ticket_categories,public.registrations,public.checkins,public.checkin_audit,public.registration_sequences from anon,authenticated;
grant select on public.events,public.event_members,public.ticket_categories,public.registrations,public.checkins,public.checkin_audit to authenticated;

create function public.validate_event_data(p_data jsonb,p_categories jsonb) returns void language plpgsql set search_path=public,pg_temp as $$declare c jsonb;begin
 if p_data->>'title' is null or p_data->>'organizer' is null or p_data->>'venue' is null or p_data->>'city' is null or length(trim(p_data->>'title')) not between 1 and 160 or length(trim(p_data->>'organizer')) not between 1 and 100 or length(trim(p_data->>'venue')) not between 1 and 200 or length(trim(p_data->>'city')) not between 1 and 100 then raise exception 'Complete the event identity.';end if;
 if (p_data->>'singleEntry')::boolean is distinct from true then raise exception 'Single-entry tickets are required.';end if;
 if (p_data->>'registrationOpen')::boolean is null or (p_data->>'allowOverride')::boolean is null then raise exception 'Entry settings are required.';end if;
 if (p_data->>'date')::date is null or (p_data->>'start')::time is null or (p_data->>'end')::time is null or (p_data->>'start')::time >= (p_data->>'end')::time then raise exception 'Choose a valid one-day event time range.';end if;
 if not exists(select 1 from pg_timezone_names where name=p_data->>'timeZone') then raise exception 'Choose a valid time zone.';end if;
 if jsonb_typeof(p_categories) is distinct from 'array' or jsonb_array_length(p_categories) not between 1 and 20 then raise exception 'Keep between 1 and 20 categories.';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_categories))<>jsonb_array_length(p_categories) then raise exception 'Ticket categories must be unique.';end if;
 for c in select value from jsonb_array_elements(p_categories) loop
  if (c->>'id')::uuid is null or c->>'name' is null or length(trim(c->>'name')) not between 1 and 100 or (c->>'price')::numeric is null or (c->>'price')::numeric<0 or (c->>'price')::numeric<>trunc((c->>'price')::numeric) or (c->>'capacity')::numeric is null or (c->>'capacity')::numeric not between 0 and 100000 or (c->>'capacity')::numeric<>trunc((c->>'capacity')::numeric) or (c->>'open')::boolean is null or jsonb_typeof(c->'benefits') is distinct from 'array' then raise exception 'Invalid ticket category.';end if;
 end loop;
end $$;
revoke all on function public.validate_event_data(jsonb,jsonb) from public;

create function public.initialize_event(p_data jsonb,p_categories jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare eid uuid:=(p_data->>'id')::uuid;c jsonb;begin
 if auth.uid() is null then raise exception 'Organizer authentication required.';end if;
 perform pg_advisory_xact_lock(hashtextextended(eid::text,0));
 if exists(select 1 from public.events where id=eid) then if public.is_event_admin(eid) then return eid;else raise exception 'This event belongs to another organizer.';end if;end if;
 if not exists(select 1 from public.organizer_accounts where user_id=auth.uid()) then raise exception 'This account is not authorized to create an event.';end if;
 perform public.validate_event_data(p_data,p_categories);insert into public.events(id,data) values(eid,p_data);insert into public.event_members values(eid,auth.uid(),'admin');
 for c in select value from jsonb_array_elements(p_categories) loop insert into public.ticket_categories(id,event_id,data) values((c->>'id')::uuid,eid,c);end loop;return eid;
end $$;
revoke all on function public.initialize_event(jsonb,jsonb) from public;grant execute on function public.initialize_event(jsonb,jsonb) to authenticated;

create function public.get_event_public(p_event uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('event',e.data,'categories',coalesce((select jsonb_agg(c.data||jsonb_build_object('registered',(select count(*) from public.registrations r where r.category_id=c.id))) from public.ticket_categories c where c.event_id=e.id),'[]'::jsonb)) from public.events e where e.id=p_event
$$;
revoke all on function public.get_event_public(uuid) from public;grant execute on function public.get_event_public(uuid) to anon,authenticated;

create function public.attendee_json(r public.registrations) returns jsonb language sql stable set search_path=public,pg_temp as $$select jsonb_build_object('id',r.id,'eventId',r.event_id,'token',r.token,'number',r.number,'requestId',r.request_id,'categoryId',r.category_id,'name',r.name,'email',r.email,'phone',coalesce(r.details->>'phone',''),'organization',coalesce(r.details->>'organization',''),'jobTitle',coalesce(r.details->>'jobTitle',''),'notes',coalesce(r.details->>'notes',''),'createdAt',r.created_at,'sample',false)$$;
create function public.checkin_json(c public.checkins) returns jsonb language sql stable set search_path=public,pg_temp as $$select jsonb_build_object('id',c.id,'registrationId',c.registration_id,'createdAt',c.created_at,'method',c.method,'actor',c.actor)$$;
revoke all on function public.attendee_json(public.registrations),public.checkin_json(public.checkins) from public;

create function public.get_event_admin(p_event uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare e jsonb;begin
 if not public.is_event_staff(p_event) then raise exception 'Organizer or staff access required.';end if;select data into e from public.events where id=p_event;
 return jsonb_build_object('event',e,'categories',coalesce((select jsonb_agg(data) from public.ticket_categories where event_id=p_event),'[]'),'attendees',coalesce((select jsonb_agg(public.attendee_json(r)) from public.registrations r where event_id=p_event),'[]'),'checkins',coalesce((select jsonb_agg(public.checkin_json(c)) from public.checkins c where event_id=p_event),'[]'),'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'registrationId',a.registration_id,'createdAt',a.created_at,'action',a.action,'actor',a.actor,'reason',a.reason)) from public.checkin_audit a where event_id=p_event),'[]'));
end $$;
revoke all on function public.get_event_admin(uuid) from public;grant execute on function public.get_event_admin(uuid) to authenticated;

create function public.get_public_ticket(p_token uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$select jsonb_build_object('event',jsonb_build_object('id',e.id,'title',e.data->>'title','organizer',e.data->>'organizer','date',e.data->>'date','start',e.data->>'start','end',e.data->>'end','timeZone',e.data->>'timeZone','venue',e.data->>'venue','city',e.data->>'city','poster',e.data->>'poster'),'name',r.name,'category',c.data->>'name','benefits',c.data->'benefits','number',r.number,'token',r.token,'demo',false,'sample',false) from public.registrations r join public.events e on e.id=r.event_id join public.ticket_categories c on c.id=r.category_id where r.token=p_token$$;
revoke all on function public.get_public_ticket(uuid) from public;grant execute on function public.get_public_ticket(uuid) to anon,authenticated;

create function public.register_attendee(p_event uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare e jsonb;c public.ticket_categories;old public.registrations;request uuid:=(p_input->>'requestId')::uuid;cat uuid:=(p_input->>'categoryId')::uuid;mail text:=lower(trim(p_input->>'email'));full_name text:=trim(p_input->>'name');phone text:=trim(coalesce(p_input->>'phone',''));business_day date;seq integer;token uuid:=gen_random_uuid();begin
 if request is null or cat is null then raise exception 'Invalid registration request.';end if;
 -- Serializes capacity and numbering, including retries across devices.
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,0));
 select * into old from public.registrations where event_id=p_event and request_id=request;if old.id is not null then return public.get_public_ticket(old.token);end if;
 select data into e from public.events where id=p_event;if e is null or (e->>'registrationOpen')::boolean is distinct from true then raise exception 'Registration is currently closed.';end if;
 if full_name is null or length(full_name) not between 2 and 100 or mail is null or length(mail)>150 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a full name and valid email address.';end if;
 if phone<>'' and phone !~ '^\+?[0-9 ().-]{7,25}$' then raise exception 'Enter a valid phone number or leave it blank.';end if;
 if length(coalesce(p_input->>'organization',''))>150 or length(coalesce(p_input->>'jobTitle',''))>100 or length(coalesce(p_input->>'notes',''))>1000 then raise exception 'An optional field is too long.';end if;
 if exists(select 1 from public.registrations where event_id=p_event and email=mail) then raise exception 'This email already has a registration. Use the saved ticket link or contact the organizer.';end if;
 select * into c from public.ticket_categories where id=cat and event_id=p_event for update;if c.id is null or (c.data->>'open')::boolean is distinct from true then raise exception 'This ticket is not open for registration.';end if;
 if (select count(*) from public.registrations where category_id=cat)>=c.capacity then raise exception 'This ticket category is sold out.';end if;
 business_day:=(clock_timestamp() at time zone (e->>'timeZone'))::date;insert into public.registration_sequences(event_id,day,value) values(p_event,business_day,1) on conflict(event_id,day) do update set value=registration_sequences.value+1 returning value into seq;
 insert into public.registrations(event_id,category_id,token,request_id,number,email,name,details) values(p_event,cat,token,request,'EVT-'||to_char(business_day,'YYYYMMDD')||'-'||lpad(seq::text,4,'0'),mail,full_name,jsonb_build_object('phone',phone,'organization',coalesce(p_input->>'organization',''),'jobTitle',coalesce(p_input->>'jobTitle',''),'notes',coalesce(p_input->>'notes','')));
 return public.get_public_ticket(token);
end $$;
revoke all on function public.register_attendee(uuid,jsonb) from public;grant execute on function public.register_attendee(uuid,jsonb) to anon,authenticated;

create function public.check_in_ticket(p_event uuid,p_token uuid,p_method text,p_override boolean default false,p_reason text default '') returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare r public.registrations;c public.checkins;cat jsonb;e jsonb;begin
 if not public.is_event_staff(p_event) then raise exception 'Organizer or staff access required.';end if;
 if p_method not in ('QR','manual') or p_method is null then raise exception 'Invalid check-in method.';end if;
 select * into r from public.registrations where token=p_token and event_id=p_event for update;
 if r.id is null then return jsonb_build_object('status','invalid','message','No valid ticket for this event was found.');end if;
 select data into cat from public.ticket_categories where id=r.category_id;select data into e from public.events where id=p_event;select * into c from public.checkins where registration_id=r.id;
 if c.id is not null then
  if p_override then
   if p_method<>'manual' or (e->>'allowOverride')::boolean is distinct from true or length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>500 then raise exception 'An override requires explicit confirmation and a reason of at least 5 characters.';end if;
   insert into public.checkin_audit(event_id,registration_id,action,actor,reason) values(p_event,r.id,'manual_override',auth.uid(),trim(p_reason));
   return jsonb_build_object('status','override','message','Entry reconfirmed. Original attendance time is preserved.','attendee',public.attendee_json(r),'category',cat,'checkin',public.checkin_json(c));
  end if;
  return jsonb_build_object('status','duplicate','message','This ticket has already been used. No additional attendance was recorded.','attendee',public.attendee_json(r),'category',cat,'checkin',public.checkin_json(c));
 end if;
 insert into public.checkins(event_id,registration_id,method,actor) values(p_event,r.id,p_method,auth.uid()) returning * into c;
 insert into public.checkin_audit(event_id,registration_id,action,actor,reason) values(p_event,r.id,'checkin_'||p_method,auth.uid(),case when p_method='manual' then 'Attendee identity confirmed by staff' else '' end);
 return jsonb_build_object('status','success','message','Ticket validated. Welcome to the event.','attendee',public.attendee_json(r),'category',cat,'checkin',public.checkin_json(c));
end $$;
revoke all on function public.check_in_ticket(uuid,uuid,text,boolean,text) from public;grant execute on function public.check_in_ticket(uuid,uuid,text,boolean,text) to authenticated;

create function public.save_event_settings(p_event uuid,p_data jsonb,p_categories jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare c jsonb;begin
 if not public.is_event_admin(p_event) then raise exception 'Organizer admin access required.';end if;
 if (p_data->>'id')::uuid<>p_event then raise exception 'Event identity cannot be changed.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,0));perform public.validate_event_data(p_data,p_categories);
 if exists(select 1 from public.registrations r where r.event_id=p_event and not exists(select 1 from jsonb_array_elements(p_categories) x where (x->>'id')::uuid=r.category_id)) then raise exception 'A category with registrations cannot be removed. Close registration instead.';end if;
 for c in select value from jsonb_array_elements(p_categories) loop
  if exists(select 1 from public.ticket_categories where id=(c->>'id')::uuid and event_id<>p_event) then raise exception 'Category belongs to a different event.';end if;
  if (c->>'capacity')::integer<(select count(*) from public.registrations where category_id=(c->>'id')::uuid) then raise exception 'Capacity cannot be below existing registrations.';end if;
  insert into public.ticket_categories(id,event_id,data) values((c->>'id')::uuid,p_event,c) on conflict(id) do update set data=excluded.data;
 end loop;
 delete from public.ticket_categories where event_id=p_event and not exists(select 1 from jsonb_array_elements(p_categories) x where (x->>'id')::uuid=ticket_categories.id);
 update public.events set data=p_data where id=p_event;
end $$;
revoke all on function public.save_event_settings(uuid,jsonb,jsonb) from public;grant execute on function public.save_event_settings(uuid,jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-posters','event-posters',true,8388608,array['image/webp','image/jpeg','image/png']) on conflict(id) do nothing;
create policy poster_public_read on storage.objects for select to anon,authenticated using(bucket_id='event-posters');
create policy poster_admin_insert on storage.objects for insert to authenticated with check(bucket_id='event-posters' and public.is_event_admin((storage.foldername(name))[1]::uuid));
create policy poster_admin_update on storage.objects for update to authenticated using(bucket_id='event-posters' and public.is_event_admin((storage.foldername(name))[1]::uuid)) with check(bucket_id='event-posters' and public.is_event_admin((storage.foldername(name))[1]::uuid));
create policy poster_admin_delete on storage.objects for delete to authenticated using(bucket_id='event-posters' and public.is_event_admin((storage.foldername(name))[1]::uuid));
