import { FactCard } from '../blocks/FactCard';

interface InfoCardProps {
  title?: string;
  body?: string;
  icon?: string;
}

/**
 * Built-in card template for AI injection.
 *
 * IMPORTANT: displayName must be set explicitly here.
 * In production/minified builds, the function name is mangled (e.g. `a`, `b`),
 * so `injectCardTool` cannot identify templates by inferred name alone.
 * Always look up templates by `T.displayName`, never by `T.name`.
 */
export function InfoCard({ title = 'Info', body = '' }: InfoCardProps) {
  return (
    <FactCard title={title} body={body} />
  );
}

// Must be explicit — minification mangles function.name in production builds.
InfoCard.displayName = 'InfoCard';
