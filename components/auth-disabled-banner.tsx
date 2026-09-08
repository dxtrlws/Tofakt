export function AuthDisabledBanner() {
  return (
    <p className="bg-status-warn/15 px-4 py-2 text-center text-ui leading-ui text-status-warn">
      AUTH_DISABLED is on. Anyone who can reach this host can read your tofa and
      Trakt credentials.
    </p>
  );
}
