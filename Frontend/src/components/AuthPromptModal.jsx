import { useNavigate } from "react-router-dom";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

// "Sign in to do that" prompt for signed-out visitors (follow, rate, radar…).
function AuthPromptModal({ onClose }) {
  const navigate = useNavigate();
  return (
    <Modal open onClose={onClose} title="Create a free account" size="sm" panelClassName="sm:max-w-sm">
      <p className="text-sm text-text-muted">Sign up to follow titles, rate what you watch and get a personalised releases calendar.</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button size="lg" full onClick={() => navigate("/register")} data-autofocus>Create account</Button>
        <Button size="lg" full variant="secondary" onClick={() => navigate("/login")}>Sign in</Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="mt-1 text-text-faint">Continue without an account</Button>
      </div>
    </Modal>
  );
}

export default AuthPromptModal;
