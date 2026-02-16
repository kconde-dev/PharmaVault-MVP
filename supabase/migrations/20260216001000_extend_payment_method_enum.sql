-- Extend legacy payment_method enum to support additional non-cash payment channels.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_method'
      and e.enumlabel = 'virement_cheque'
  ) then
    alter type payment_method add value 'virement_cheque';
  end if;

  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_method'
      and e.enumlabel = 'carte_bancaire'
  ) then
    alter type payment_method add value 'carte_bancaire';
  end if;
end
$$;
