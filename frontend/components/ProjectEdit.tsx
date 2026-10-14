"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProjectForm from "@/components/ProjectForm";
import { api } from "@/lib/api";
import {
  projectToFormData,
  type ProjectDetail,
  type ProjectFormData,
} from "@/lib/project";
import { errorToast } from "@/lib/toast";
import { secondaryButton } from "@/lib/ui";
import { apiMessage } from "@/lib/validation/apiError";

// Loads the project, then hands its values to the same form used for adding.
const ProjectEdit = ({ projectId }: { projectId: string }) => {
  const [initial, setInitial] = useState<ProjectFormData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get(`/project/single/${projectId}`)
      .then((response) =>
        setInitial(projectToFormData(response.data.project as ProjectDetail)),
      )
      .catch((error) => {
        setFailed(true);
        errorToast(apiMessage(error));
      });
  }, [projectId]);

  if (failed) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-[22px]">
          This project could not be loaded
        </h1>
        <Link
          href="/list/my/profile"
          className={`mt-6 inline-block ${secondaryButton}`}
        >
          Back to my profile
        </Link>
      </main>
    );
  }

  if (!initial) {
    return (
      <main
        className="mx-auto w-full max-w-3xl px-5 py-8 lg:py-12"
        aria-busy="true"
      >
        <div className="h-9 w-56 animate-pulse rounded bg-line" />
        <div className="mt-8 h-72 animate-pulse rounded-xl bg-line" />
      </main>
    );
  }

  return <ProjectForm projectId={projectId} initial={initial} />;
};

export default ProjectEdit;
