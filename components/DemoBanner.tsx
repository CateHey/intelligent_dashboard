export function DemoBanner({ demo, ai }: { demo: boolean; ai: boolean }) {
  if (!demo && ai) return null;

  return (
    <div className="banner">
      <span className="banner-tag">DEMO</span>
      <div>
        {demo ? (
          <>
            Datos <strong>sembrados</strong> en un Postgres embebido (PGlite) — sin
            Supabase. El portero y el SQL se ejecutan de verdad.
          </>
        ) : null}
        {demo && !ai ? " · " : null}
        {!ai ? (
          <>
            Sin <code>ANTHROPIC_API_KEY</code>: el chat usa un{" "}
            <strong>traductor local</strong> por palabras clave y un analista que
            calcula sobre las filas reales.
          </>
        ) : null}
      </div>
    </div>
  );
}
