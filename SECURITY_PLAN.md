Here is the finalized prompt for Kimi 2.5 in a markdown code block for easy copying. This prompt is specifically structured to utilize the model's trillion-parameter mixture-of-experts (MoE) architecture and "Thinking Mode" for deep logical traversal.[1, 2] It focuses on framework-specific vulnerabilities identified in recent security research, such as the Quarkus parameter leakage (CVE-2025-1247) and the Next.js Flight Protocol flaw (CVE-2025-66478).[3, 4]

# Role: Senior Fullstack Architect & Cybersecurity Auditor
# Task: Non-destructive Security Scan and Architectural Simplification Plan

## Context
You are auditing a fullstack application ecosystem. Your goal is to identify high-risk security vulnerabilities and provide a step-by-step plan to simplify the architecture using a "web-first" monorepo strategy.
- **Backend**: Quarkus (Java 21, Hibernate Panache, ArC CDI).
- **Web Frontend**: Next.js (App Router, Server Actions, RSC).
- **Mobile Frontend**: React Native / Expo (Expo Router).

## Phase 1: Expert Security Audit
Perform a deep logical scan of the codebase. Do not modify any files; only provide an analysis of the following risks:

1. **Quarkus Backend**:
   - **Request Parameter Leakage (CVE-2025-1247)**: Identify REST endpoints using field injection for request parameters (URI templates, cookies, headers) without an explicit `@RequestScoped` CDI scope. Check for shared instance state that could allow data leaks between concurrent requests.
   - **Panache Persistence**: Audit custom HQL/JPQL queries for unsafe string concatenation. Ensure all persistence logic uses parameterized APIs to prevent SQL injection.
   - **RBAC Coverage**: Verify that all Jakarta REST resources are secured with `@RolesAllowed` or `@Authenticated` annotations.

2. **Next.js Web Frontend**:
   - **React2Shell (CVE-2025-66478)**: Analyze the implementation of the React Flight Protocol. Identify patterns where server-side module references could be manipulated by an attacker to achieve remote code execution.
   - **Data Serialization Boundaries**: Locate Server Components that pass full database entities or sensitive objects to Client Components. Recommend a Data Access Layer (DAL) that returns minimal Data Transfer Objects (DTOs).
   - **Server Action Integrity**: Ensure every `use server` action internally re-verifies authentication and authorization. Audit for the presence of Zod-based runtime validation for all incoming payloads.

3. **Expo Mobile Frontend**:
   - **Secure Storage Audit**: Identify any sensitive data (JWTs, PII) stored in unencrypted `AsyncStorage`. Prepare a migration path to `expo-secure-store`.
   - **Deep Link Hijacking**: Check for custom URL schemes (e.g., `myapp://`) and lack of ownership verification. Propose a transition to Universal Links (iOS) and App Links (Android).

## Phase 2: Architectural Simplification (Solito 5 + Tamagui)
Generate a migration roadmap to a Turborepo monorepo. The goal is to maximize code sharing without compromising platform-specific performance:

1. **Universal Navigation**: Outline the use of **Solito 5** to bridge Next.js and Expo Router. Leverage Solito's web-first approach, which renders pure Next.js components on the web by dropping `react-native-web` dependencies.
2. **Shared UI Layer**: Define a `packages/ui` kit using **Tamagui** for high-performance, cross-platform views.
3. **Common Business Logic**: Propose a `packages/app` for universal screens and `packages/api` for shared Zod validation schemas.
4. **Non-Destructive Strategy**: Describe how to use `.native.tsx` for platform-specific overrides while maintaining a unified logic base.

## Output Requirements
1. A prioritized list of identified security vulnerabilities.
2. A structural diagram of the proposed monorepo.
3. A step-by-step implementation checklist.

The simplification roadmap included in the prompt utilizes Solito 5’s recent shift to a "web-first" framework that removes the `react-native-web` dependency for the web rendering path.[5, 6, 7] This ensures your Next.js application remains performant while sharing core business logic and UI components with the Expo mobile client.[8, 9, 6]
