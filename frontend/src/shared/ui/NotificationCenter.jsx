import { useUIStore } from '@app/state/uiStore';

function getTypeClasses(type) {
  switch (type) {
    case 'error':
      return 'border-l-4 border-l-red-500 bg-card text-card-foreground';
    case 'success':
      return 'border-l-4 border-l-emerald-500 bg-card text-card-foreground';
    case 'warning':
      return 'border-l-4 border-l-amber-400 bg-card text-card-foreground';
    default:
      return 'border-l-4 border-l-blue-500 bg-card text-card-foreground';
  }
}

export default function NotificationCenter() {
  const notifications = useUIStore((state) => state.notifications);
  const dismissNotification = useUIStore((state) => state.dismissNotification);

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[120] flex w-[min(92vw,340px)] flex-col gap-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={[
            'pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
            'transition-all duration-200 ease-out',
            notification.closing ? 'translate-x-6 opacity-0 scale-95' : 'translate-x-0 opacity-100 scale-100',
            getTypeClasses(notification.type),
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {notification.title ? (
                <div className="text-sm font-semibold leading-5">{notification.title}</div>
              ) : null}
              {notification.message ? (
                <div className="mt-0.5 text-sm leading-5 opacity-90">{notification.message}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notification.id)}
              className="rounded-md px-2 py-1 text-xs font-medium opacity-70 hover:opacity-100"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
