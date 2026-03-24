## Plan: TinyNumber Vercel App

Build a minimal Vercel-hosted Next.js app where anyone can submit public text or a URL, receive an integer key, and others can retrieve by key. Entries expire after 10 minutes, expired keys are silently unavailable, and the allocator always returns the smallest currently available positive integer with concurrency safety.

**Steps**
1. Phase 1: Product contract and bootstrap
2. Initialize a Next.js + TypeScript project configured for Vercel.
3. Lock request/response rules:
4. Input is public text (max 10,000 chars).
5. URL is auto-detected via validation.
6. Missing/expired key returns silent not-found behavior.
7. Add basic per-IP rate limiting for create and retrieve APIs.

8. Phase 2: Data model and key allocation engine
9. Use Redis-compatible storage (recommended: Vercel KV).
10. Store each entry with a 600-second TTL.
11. Maintain:
12. Monotonic counter for never-used keys.
13. Sorted free-key set for reusable expired keys.
14. Allocation algorithm:
15. If free-key set has values, pop smallest key.
16. Else atomically increment counter.
17. Release algorithm:
18. When a key is known to be expired/removed, insert it into free-key set idempotently.
19. Protect multi-step logic with atomic operations (Lua script or transaction strategy) to prevent collisions under concurrent requests.

20. Phase 3: API layer
21. Create endpoint:
22. Validate payload and size.
23. Detect URL vs text.
24. Allocate key using smallest-available policy.
25. Save entry with TTL and return key.
26. Retrieve endpoint:
27. Validate key is positive integer.
28. Return payload if exists.
29. Return silent missing response if not found/expired.

30. Phase 4: UI flows
31. Submit screen:
32. Input for text/URL, submit action, key result display.
33. Retrieve screen:
34. Key input and resolve action.
35. If stored value is URL, show Open button.
36. If stored value is text, render text directly.
37. Missing/expired stays silent per your requirement.
38. Ensure mobile usability and basic accessibility.

39. Phase 5: Expiry, reuse, and correctness checks
40. Verify 10-minute expiration exactly.
41. Verify smallest-key reuse order after expiry (gap filling before new key growth).
42. Verify behavior under concurrent create requests (no duplicate keys).

43. Phase 6: Testing and deployment
44. Unit tests for validation, URL detection, allocator ordering, and release idempotency.
45. Integration tests for create→retrieve, URL open-button visibility, and silent missing behavior.
46. Concurrency test for parallel creates to confirm uniqueness and smallest-available assignment.
47. Deploy to Vercel, set env vars, run preview validation, then production rollout.

**Verification**
1. Automated:
2. Allocator returns smallest free key in all tested sequences.
3. No key collisions in concurrent create tests.
4. TTL expiry causes retrieval miss after 10 minutes.
5. Manual:
6. Submit text and retrieve content by key.
7. Submit URL and confirm Open button appears and launches in new tab safely.
8. Wait past expiry and confirm key is silently unavailable.
9. Confirm expired key is reused before new higher keys are issued.

**Decisions captured**
1. URL handling: auto-detect by validation.
2. Missing/expired behavior: silent fail.
3. Content limit: 10,000 chars.
4. Include simple per-IP rate limiting in v1.

**Scope boundaries**
1. Included: anonymous public storage/retrieval, 10-minute TTL, smallest-integer reuse, URL-aware retrieval UI, basic rate limiting.
2. Excluded: auth, encryption, moderation, analytics dashboard, custom expiry durations.


