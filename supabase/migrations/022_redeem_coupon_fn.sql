-- RPC segura para marcar o cupom iFood como resgatado/visto pelo próprio membro
CREATE OR REPLACE FUNCTION public.redeem_coupon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    coupon_redeemed_at = COALESCE(coupon_redeemed_at, now()),
    coupon_seen_at     = COALESCE(coupon_seen_at, now())
  WHERE auth_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_coupon FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_coupon TO authenticated;
