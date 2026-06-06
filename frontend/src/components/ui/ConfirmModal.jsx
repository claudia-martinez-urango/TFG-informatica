function ConfirmModal({
  title,
  message,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{title}</h3>

        <p>{message}</p>

        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            {cancelText}
          </button>

          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;