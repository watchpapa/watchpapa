import AuthLayout from "../../layouts/AuthLayout.jsx";
import CompleteUsernameForm from "../../features/auth/components/CompleteUsernameForm.jsx";

function CompleteUsernamePage({ session, initialUsername, onCompleted }) {
  return (
    <AuthLayout>
      <CompleteUsernameForm
        userId={session?.user?.id}
        initialUsername={initialUsername}
        onCompleted={onCompleted}
      />
    </AuthLayout>
  );
}

export default CompleteUsernamePage;
