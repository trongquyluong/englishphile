import { AuthForm } from "@/components/auth/AuthForm";
import { signUpAction } from "@/app/auth/actions";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center py-8">
      <AuthForm mode="sign-up" action={signUpAction} error={error} />
    </div>
  );
}
