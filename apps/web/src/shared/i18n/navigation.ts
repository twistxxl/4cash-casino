import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Обёртки над next/link и next/navigation, которые сами подставляют текущую локаль в URL
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
