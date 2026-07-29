BEGIN;

DO $$
DECLARE
    v_user_a uuid := gen_random_uuid();
    v_user_b uuid := gen_random_uuid();
    v_token_a uuid := gen_random_uuid();
    v_token_b uuid := gen_random_uuid();
    v_loaded jsonb;
    v_count integer;
BEGIN
    INSERT INTO public.specrefiner_users (
        id,
        email,
        password_hash,
        is_admin
    )
    VALUES
        (
            v_user_a,
            format('rpc-isolation-a-%s@invalid.example', v_user_a),
            'temporary-test-hash',
            false
        ),
        (
            v_user_b,
            format('rpc-isolation-b-%s@invalid.example', v_user_b),
            'temporary-test-hash',
            false
        );

    INSERT INTO public.specrefiner_auth_tokens (token, user_id)
    VALUES
        (v_token_a, v_user_a),
        (v_token_b, v_user_b);

    INSERT INTO public.specrefiner_sessions (user_id, messages)
    VALUES
        (
            v_user_a,
            '[{"role":"assistant","content":"isolation-a"}]'::jsonb
        ),
        (
            v_user_b,
            '[{"role":"assistant","content":"isolation-b"}]'::jsonb
        );

    SELECT loaded.messages
    INTO v_loaded
    FROM public.load_user_session_v2(v_token_a) AS loaded;

    IF v_loaded IS DISTINCT FROM
        '[{"role":"assistant","content":"isolation-a"}]'::jsonb
    THEN
        RAISE EXCEPTION 'Token A loaded another user session';
    END IF;

    SELECT loaded.messages
    INTO v_loaded
    FROM public.load_user_session_v2(v_token_b) AS loaded;

    IF v_loaded IS DISTINCT FROM
        '[{"role":"assistant","content":"isolation-b"}]'::jsonb
    THEN
        RAISE EXCEPTION 'Token B loaded another user session';
    END IF;

    PERFORM public.save_user_session_v2(
        v_token_a,
        '[{"role":"assistant","content":"updated-a"}]'::jsonb,
        'complete',
        7,
        'spec-a',
        true,
        3
    );

    SELECT count(*)
    INTO v_count
    FROM public.specrefiner_sessions AS session
    WHERE session.user_id = v_user_a
      AND session.messages =
        '[{"role":"assistant","content":"updated-a"}]'::jsonb
      AND session.phase = 'complete'
      AND session.question_count = 7
      AND session.final_spec = 'spec-a';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Token A did not update its own session';
    END IF;

    SELECT count(*)
    INTO v_count
    FROM public.specrefiner_sessions AS session
    WHERE session.user_id = v_user_b
      AND session.messages =
        '[{"role":"assistant","content":"isolation-b"}]'::jsonb;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Token A modified user B session';
    END IF;

    PERFORM public.clear_user_session_v2(v_token_a);

    SELECT count(*)
    INTO v_count
    FROM public.specrefiner_sessions AS session
    WHERE session.user_id = v_user_a;

    IF v_count <> 0 THEN
        RAISE EXCEPTION 'Token A did not clear its own session';
    END IF;

    SELECT count(*)
    INTO v_count
    FROM public.specrefiner_sessions AS session
    WHERE session.user_id = v_user_b;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'Token A cleared user B session';
    END IF;

    DELETE FROM public.specrefiner_auth_tokens
    WHERE user_id IN (v_user_a, v_user_b);

    DELETE FROM public.specrefiner_sessions
    WHERE user_id IN (v_user_a, v_user_b);

    DELETE FROM public.specrefiner_users
    WHERE id IN (v_user_a, v_user_b);
END;
$$;

DO $$
DECLARE
    v_role name;
    v_signature text;
BEGIN
    FOREACH v_role IN ARRAY ARRAY[
        'anon'::name,
        'authenticated'::name,
        'service_role'::name
    ]
    LOOP
        FOREACH v_signature IN ARRAY ARRAY[
            'public.load_user_session(uuid)',
            'public.save_user_session(uuid,jsonb,text,integer,text,boolean,integer)',
            'public.clear_user_session(uuid)'
        ]
        LOOP
            IF has_function_privilege(v_role, v_signature, 'EXECUTE') THEN
                RAISE EXCEPTION
                    'Role % can still execute legacy RPC %',
                    v_role,
                    v_signature;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

ROLLBACK;
