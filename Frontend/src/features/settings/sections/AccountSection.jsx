import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase.js";
import SettingsSection from "../../../components/settings/SettingsSection.jsx";
import SettingsRow from "../../../components/settings/SettingsRow.jsx";
import Button from "../../../components/ui/Button.jsx";
import Modal from "../../../components/ui/Modal.jsx";

function AccountSection() {
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleted, setDeleted] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.rpc("delete_account");
    setDeleting(false);
    if (error) { setDeleteError(error.message ?? "Failed to delete account."); return; }
    setDeleteConfirm(false);
    setDeleted(true);
  };

  return (
    <>
      <SettingsSection id="account" title="Account" danger>
        <SettingsRow label="Delete account" hint="Permanently deletes your profile, ratings, watchlists and follows.">
          <Button variant="danger" size="md" onClick={() => { setDeleteConfirm(true); setDeleteError(null); }}>Delete my account</Button>
        </SettingsRow>
      </SettingsSection>

      <Modal
        open={deleteConfirm}
        onClose={() => !deleting && setDeleteConfirm(false)}
        title="Delete your account?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteAccount} loading={deleting}>Yes, delete everything</Button>
          </div>
        }
      >
        <p className="text-sm text-text">This permanently deletes all your data. There is no undo.</p>
        {deleteError && <p className="mt-3 text-xs text-red-300">{deleteError}</p>}
      </Modal>

      <Modal open={deleted} onClose={() => {}} title="Account deleted" size="sm" hideClose footer={
        <Button full onClick={async () => { await supabase.auth.signOut(); navigate("/login", { replace: true }); }}>OK</Button>
      }>
        <p className="text-sm text-text">Your account has been successfully deleted.</p>
        <p className="mt-2 text-sm text-text-faint">Your remaining data will be permanently removed within 30 days.</p>
      </Modal>
    </>
  );
}

export default AccountSection;
