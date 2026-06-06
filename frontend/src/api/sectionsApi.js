import { supabase } from "../auth/supabaseClient";

const SECTION_SELECT =
  "id, folder_id, name, description, order_index, is_visible_to_students, created_at";

export async function getFolderSections(folderId) {
  const { data, error } = await supabase.rpc("get_folder_sections", {
    p_folder_id: folderId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((section) => ({
    id: section.result_section_id,
    folder_id: section.result_folder_id,
    name: section.result_name,
    description: section.result_description,
    order_index: section.result_order_index,
    is_visible_to_students: section.result_is_visible_to_students,
    created_at: section.result_created_at,
  }));
}

export async function createFolderSection({
  folderId,
  name,
  description,
  orderIndex,
}) {
  const { data, error } = await supabase
    .from("folder_sections")
    .insert({
      folder_id: folderId,
      name,
      description,
      order_index: orderIndex,
      is_visible_to_students: false,
    })
    .select(SECTION_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateFolderSection({
  sectionId,
  name,
  description,
  orderIndex,
}) {
  const { data, error } = await supabase
    .from("folder_sections")
    .update({
      name,
      description,
      order_index: orderIndex,
    })
    .eq("id", sectionId)
    .select(SECTION_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateSectionVisibility({
  sectionId,
  isVisibleToStudents,
}) {
  const { data, error } = await supabase
    .from("folder_sections")
    .update({
      is_visible_to_students: isVisibleToStudents,
    })
    .eq("id", sectionId)
    .select(SECTION_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteFolderSection(sectionId) {
  const { error } = await supabase
    .from("folder_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    throw new Error(error.message);
  }

  return true;
}