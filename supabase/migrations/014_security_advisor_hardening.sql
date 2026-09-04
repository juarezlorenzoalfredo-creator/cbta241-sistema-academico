begin;

-- Trigger helpers must never inherit a caller-controlled search_path.
alter function public.set_updated_at() set search_path=public;
alter function public.prevent_delete() set search_path=public;

-- Supabase grants EXECUTE on new public-schema functions by default. Start from
-- deny-by-default and expose only the RPC surface that is intentionally callable.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_primary_role() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_teacher_id() to authenticated;
grant execute on function public.current_user_has_role(public.app_role) to authenticated;
grant execute on function public.student_owns_sse(uuid) to authenticated;
grant execute on function public.teacher_owns_assignment(uuid) to authenticated;

grant execute on function public.save_grade_draft(uuid,uuid,public.grade_kind,numeric,integer) to authenticated;
grant execute on function public.publish_assignment_grades(uuid,uuid,text) to authenticated;
grant execute on function public.correct_published_grade(uuid,public.grade_kind,numeric,text,integer) to authenticated;
grant execute on function public.request_grade_correction(uuid,public.grade_kind,numeric,text) to authenticated;
grant execute on function public.resolve_grade_correction_request(uuid,boolean,text) to authenticated;
grant execute on function public.authorize_extraordinary(uuid,text) to authenticated;
grant execute on function public.capture_extraordinary(uuid,numeric,integer) to authenticated;
grant execute on function public.publish_extraordinary(uuid,integer) to authenticated;
grant execute on function public.transition_evaluation_period(uuid,public.evaluation_state,text,integer) to authenticated;

grant execute on function public.create_academic_period_workflow(public.period_kind,integer,boolean) to authenticated;
grant execute on function public.create_student_record(text,text) to authenticated;
grant execute on function public.create_teacher_record(text,text) to authenticated;
grant execute on function public.create_subject_record(text,text) to authenticated;
grant execute on function public.create_group_record(uuid,uuid,text,text) to authenticated;
grant execute on function public.enroll_student_workflow(uuid,uuid,uuid,uuid,uuid[]) to authenticated;
grant execute on function public.assign_teacher_workflow(uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.close_academic_period_workflow(uuid,integer,text) to authenticated;
grant execute on function public.set_student_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.set_teacher_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.replace_teacher_assignment_workflow(uuid,uuid,text) to authenticated;
grant execute on function public.provision_user_profile_workflow(uuid,text,text,public.app_role,uuid,uuid) to authenticated;
grant execute on function public.replace_user_role_workflow(uuid,public.app_role,text) to authenticated;
grant execute on function public.set_user_active_workflow(uuid,boolean,text) to authenticated;
grant execute on function public.update_institution_settings_workflow(text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.log_session_event(text) to authenticated;
grant execute on function public.get_my_extraordinary_overview() to authenticated;

grant execute on function public.register_academic_document(uuid,uuid,public.document_type,text,text,text,text,text) to authenticated;
grant execute on function public.supersede_academic_document(uuid,text,text,text,text) to authenticated;
grant execute on function public.revoke_academic_document(uuid,text) to authenticated;

-- The verification endpoint is intentionally public and data-minimized.
grant execute on function public.verify_academic_document(text) to anon, authenticated;

commit;
