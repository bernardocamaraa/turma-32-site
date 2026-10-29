import { Button } from './Button';
import { Card } from './Card';
import { Carregando } from './Carregando';

/**
 * A tab of the committee area while its data loads — or, if it didn't, why
 * and a way to try again. The code was already checked when entering the
 * area, so there's no login here.
 */
export function CarregandoSecao({ erro, onTentar }: { erro: string | null; onTentar: () => void }) {
  if (!erro) return <Carregando />;
  return (
    <Card padding="var(--space-7)">
      <p style={{ margin: 0, fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--state-error)' }}>{erro}</p>
      <div style={{ display: 'flex', marginTop: 'var(--space-5)' }}>
        <Button variant="secondary" onClick={onTentar}>
          Tentar de novo
        </Button>
      </div>
    </Card>
  );
}
