import { supabase } from "../auth/supabaseClient";

const FOLDER_SELECT =
  "id, name, description, join_code, created_at, organization_id, teacher_id, is_visible_to_students";

function generateJoinCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function getTeacherOrganization(teacherId) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, teacher_id, created_at")
    .eq("teacher_id", teacherId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function createOrganization({ name, teacherId }) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name,
      teacher_id: teacherId,
    })
    .select("id, name, teacher_id, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateOrganization({ organizationId, name }) {
  const { data, error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", organizationId)
    .select("id, name, teacher_id, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getTeacherFolders(teacherId) {
  const { data, error } = await supabase
    .from("learning_folders")
    .select(FOLDER_SELECT)
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createLearningFolder({
  organizationId,
  teacherId,
  name,
  description,
}) {
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from("learning_folders")
      .insert({
        organization_id: organizationId,
        teacher_id: teacherId,
        name,
        description,
        join_code: joinCode,
      })
      .select(FOLDER_SELECT)
      .single();

    if (!error) {
      return data;
    }

    lastError = error;

    if (!error.message.toLowerCase().includes("duplicate")) {
      break;
    }
  }

  throw new Error(lastError?.message || "Could not create folder");
}

export async function updateLearningFolder({ folderId, name, description }) {
  const { data, error } = await supabase
    .from("learning_folders")
    .update({ name, description })
    .eq("id", folderId)
    .select(FOLDER_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateFolderVisibility({ folderId, isVisibleToStudents }) {
  const { data, error } = await supabase
    .from("learning_folders")
    .update({ is_visible_to_students: isVisibleToStudents })
    .eq("id", folderId)
    .select(FOLDER_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteLearningFolder(folderId) {
  const { error } = await supabase
    .from("learning_folders")
    .delete()
    .eq("id", folderId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function getFolderStudents(folderId) {
  const { data, error } = await supabase.rpc("get_folder_students", {
    p_folder_id: folderId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((student) => ({
    student_id: student.result_student_id,
    first_name: student.result_first_name,
    last_name: student.result_last_name,
    email: student.result_email,
    joined_at: student.result_joined_at,
  }));
}

export async function requestJoinFolderByCode(joinCode) {
  const { data, error } = await supabase.rpc("request_join_folder_by_code", {
    p_folder_code: joinCode,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = data?.[0];

  if (!result) {
    return null;
  }

  return {
    request_id: result.result_request_id,
    folder_id: result.result_folder_id,
    folder_name: result.result_folder_name,
    status: result.result_status,
    organization_name: result.result_organization_name,
  };
}

export async function getFolderJoinRequests(folderId) {
  const { data, error } = await supabase.rpc("get_folder_join_requests", {
    p_folder_id: folderId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((request) => ({
    request_id: request.result_request_id,
    student_id: request.result_student_id,
    first_name: request.result_first_name,
    last_name: request.result_last_name,
    email: request.result_email,
    status: request.result_status,
    requested_at: request.result_requested_at,
  }));
}

export async function approveFolderJoinRequest(requestId) {
  const { error } = await supabase.rpc("approve_folder_join_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function rejectFolderJoinRequest(requestId) {
  const { error } = await supabase.rpc("reject_folder_join_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function removeStudentFromFolder(folderId, studentId) {
  const { error } = await supabase.rpc("remove_student_from_folder", {
    p_folder_id: folderId,
    p_student_id: studentId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export async function getMyStudentFolders() {
  const { data, error } = await supabase.rpc("get_my_student_folders");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((folder) => ({
    folder_id: folder.result_folder_id,
    folder_name: folder.result_folder_name,
    folder_description: folder.result_folder_description,
    join_code: folder.result_join_code,
    organization_name: folder.result_organization_name,
    joined_at: folder.result_joined_at,
  }));
}
