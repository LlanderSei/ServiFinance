import type { ReactNode } from "react";

type RecordDetailItem = {
  label: string;
  value: ReactNode;
};

type RecordDetailSection = {
  title: string;
  items: RecordDetailItem[];
};

type RecordDetailsModalProps = {
  open: boolean;
  title: string;
  eyebrow: string;
  sections: RecordDetailSection[];
  actions?: ReactNode;
  onClose: () => void;
};

export function RecordDetailsModal({
  open,
  title,
  eyebrow,
  sections,
  actions,
  onClose
}: RecordDetailsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="record-modal-backdrop" onClick={onClose}>
      <div
        className="record-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="record-modal__header">
          <div>
            <p className="record-modal__eyebrow">{eyebrow}</p>
            <h2 className="record-modal__title">{title}</h2>
          </div>

          <button type="button" className="record-modal__close" onClick={onClose} aria-label="Close details">
            x
          </button>
        </header>

        <div className="record-modal__content">
          {sections.map((section) => (
            <section key={section.title} className="record-modal__section">
              <h3 className="record-modal__section-title">{section.title}</h3>

              <dl className="record-modal__grid">
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.label}`} className="record-modal__item">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {actions ? (
          <footer className="record-modal__actions">
            {actions}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
