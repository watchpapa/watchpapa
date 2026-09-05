import AuthLayout from "../../layouts/AuthLayout.jsx";
import CompleteUsernameForm from "../../features/auth/components/CompleteUsernameForm.jsx";
import { PageHead } from "../../components/ui/PageHead.jsx";

function CompleteUsernamePage({ session, initialUsername, onCompleted }) {
  return (
    <AuthLayout>
      <PageHead title="Finish setting up" path="/complete-username" noindex />
      <CompleteUsernameForm
        userId={session?.user?.id}
        initialUsername={initialUsername}
        onCompleted={onCompleted}
      />
    </AuthLayout>
  );
}

export default CompleteUsernamePage;
