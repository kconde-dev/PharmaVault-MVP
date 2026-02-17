-- Normalize and relax transactions_type_check to handle legacy/modern casing safely.

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and pg_get_constraintdef(oid) ilike '%type%'
      and conname ilike '%transactions%type%check%'
  loop
    execute format('alter table public.transactions drop constraint if exists %I', c.conname);
  end loop;
end
$$;

update public.transactions
set type = case
  when lower(coalesce(type::text, '')) in ('income', 'recette') then 'Recette'
  when lower(coalesce(type::text, '')) in ('expense', 'depense', 'dépense') then 'Dépense'
  when lower(coalesce(type::text, '')) in ('credit', 'crédit') then 'Crédit'
  when lower(coalesce(type::text, '')) in ('retour', 'refund', 'returned') then 'Retour'
  else coalesce(type::text, 'Recette')
end;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transactions'::regclass
      and conname = 'transactions_type_check'
  ) then
    alter table public.transactions
      add constraint transactions_type_check
      check (type in ('Recette', 'Dépense', 'Crédit', 'Retour', 'recette', 'dépense', 'crédit', 'retour', 'income', 'expense', 'credit', 'refund'));
  end if;
end
$$;

notify pgrst, 'reload schema';
