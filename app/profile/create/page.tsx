import FormInput from "@/components/form/FormInput";
import { SubmitButton } from "@/components/form/Buttons";
import FormContainer from "@/components/form/FormContainer";
import { createProfileAction } from "@/utils/actions";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import db from "@/utils/db";

async function CreateProfile() {
  const { userId } = auth();
  if (!userId) redirect("/");

  const profile = await db.profile.findUnique({
    where: { clerkId: userId },
    select: { clerkId: true },
  });
  if (profile) redirect("/");

  return (
    <section className="min-h-[calc(100vh-10rem)] flex items-center justify-center py-8 sm:py-12">
      <div className="w-full max-w-xl rounded-2xl border bg-card shadow-sm p-6 sm:p-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">Create your profile</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Add your basic details to start listing, booking, and saving stays.
          </p>
        </div>

        <FormContainer action={createProfileAction}>
          <div className="grid gap-4">
            <FormInput type="text" name="firstName" label="First Name" />
            <FormInput type="text" name="lastName" label="Last Name" />
            <FormInput type="text" name="username" label="Username" />
          </div>
          <SubmitButton text="Create Profile" className="mt-7 w-full" />
        </FormContainer>
      </div>
    </section>
  );
}
export default CreateProfile;
