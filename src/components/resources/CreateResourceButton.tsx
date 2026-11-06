type Props = { label: string; onClick: () => void };

export function CreateResourceButton({ label, onClick }: Props) {
  return <button aria-label={label} title={label} className="library-rail-add-button" onClick={onClick} type="button">
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12" /></svg>
  </button>;
}
