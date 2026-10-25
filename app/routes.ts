import {flatRoutes} from '@react-router/fs-routes';
import type {RouteConfig} from '@react-router/dev/routes';

// File-based routes from app/routes. Manual route definitions can be added to
// the array instead of, or in addition to, the flat-routes convention:
// https://reactrouter.com/api/framework-conventions/routes.ts#routests
export default flatRoutes() satisfies RouteConfig;
