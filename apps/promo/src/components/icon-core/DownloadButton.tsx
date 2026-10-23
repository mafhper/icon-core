import { useDetectedOS } from '../../hooks/use-os';
import { cn } from '../../lib/cn';
import { suggestedDesktopTarget } from '../../lib/platform';
import { downloadTargets, siteConfig, type DesktopOS } from '../../lib/site-config';
import { SplitButton } from '../../ui/SplitButton';
import { buttonClass, type ButtonSize, type ButtonVariant } from '../../ui/buttonStyles';
import { DownloadIcon, GlobeIcon } from './icons';
import { OsIcon } from './os-icons';

const openReleases = () => window.open(siteConfig.releasesUrl, '_blank', 'noopener,noreferrer');

/** Link to the web app. An anchor, not a button: it navigates. */
export function WebAppButton({
  className,
  size = 'default',
  variant = 'outline',
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <a
      href={siteConfig.webAppUrl}
      target="_blank"
      rel="noreferrer"
      className={buttonClass({ variant, size, className: cn('rounded-full', className) })}
    >
      <GlobeIcon />
      Abrir no navegador
    </a>
  );
}

/**
 * Installer for the detected system, with the other systems in the menu. Phones cannot run
 * the desktop app, so they get the web app instead — or nothing, when the caller already
 * offers the web app next to it.
 */
export function DownloadButton({
  className,
  size = 'default',
  mobileFallback = true,
}: {
  className?: string;
  size?: ButtonSize;
  mobileFallback?: boolean;
}) {
  const os = useDetectedOS();
  const target = suggestedDesktopTarget(os);
  const mobile = os === 'ios' || os === 'android';

  if (mobile && !mobileFallback) return null;
  if (mobile) return <WebAppButton size={size} variant="default" className={cn('shadow-float', className)} />;

  const main = target ? downloadTargets[target] : null;
  const others = (Object.keys(downloadTargets) as DesktopOS[]).map((key) => {
    const item = downloadTargets[key];
    return {
      id: key,
      label: `${item.label} · ${item.files.join(' ')}${key === target ? ' · seu sistema' : ''}`,
      onSelect: openReleases,
    };
  });

  return (
    <SplitButton
      label={main ? `Baixar para ${main.label}` : 'Baixar app'}
      icon={main ? <OsIcon os={main.os} className="size-4" /> : <DownloadIcon className="size-4" />}
      actionHref={siteConfig.releasesUrl}
      items={others}
      menuLabel="Outros sistemas"
      size={size}
      pill
      className={cn('shadow-float', className)}
    />
  );
}
