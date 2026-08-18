import {
  AlertTriangle,
  // Bell,
  FileText,
  Image,
  Key,
  LayoutDashboard,
  Map,
  MessageSquare,
  Newspaper,
  Trees,
  Users,
  Waves,
} from 'lucide-react'
import type { NavItem } from '@/types/common/index'

export const navConfig: NavItem[] = [
  {
    icon: <LayoutDashboard />,
    name: 'Tổng quan',
    path: '/dashboard',
    permission: { resource: 'statistics', action: 'dashboard' },
  },
  // ── GIS ──
  {
    icon: <Map />,
    name: 'Lớp bản đồ',
    path: '/map-layers',
    permission: { resource: 'map_layers', action: 'read' },
    subItems: [
      {
        name: 'Quản lý lớp dữ liệu',
        path: '/map-layers',
        permission: { resource: 'map_layers', action: 'read' },
      },
      {
        name: 'Nhập file GIS',
        path: '/map-layers/import-geojson',
        permission: { resource: 'map_layers', action: 'create' },
      },
    ],
  },
  {
    icon: <Key />,
    name: 'API bản đồ',
    path: '/map-apis',
    permission: { resource: 'map_apis', action: 'read' },
  },

  {
    icon: <Image />,
    name: 'Ảnh bản đồ',
    path: '/map-images',
    permission: { resource: 'pdf_maps', action: 'read' },
  },
  {
    icon: <FileText />,
    name: 'Văn bản tài liệu',
    path: '/documents',
    permission: { resource: 'documents', action: 'read' },
  },
  {
    icon: <Trees />,
    name: 'Phân loại đối tượng',
    path: '/forest-classification',
    permission: { resource: 'forest_classification', action: 'read' },
  },
  {
    icon: <Waves />,
    name: 'Ngập lụt và thủy văn',
    path: '/flood',
    permission: { resource: 'flood', action: 'read' },
  },
  {
    icon: <Waves />,
    name: 'Kịch bản thủy văn',
    path: '/kttv-scenarios',
    permission: { resource: 'kttv_scenarios', action: 'read' },
  },
  // ── Nội dung ──
  {
    icon: <Newspaper />,
    name: 'Tin tức',
    path: '/news',
    permission: { resource: 'news', action: 'read' },
    subItems: [
      { name: 'Tin tức', path: '/news', permission: { resource: 'news', action: 'read' } },
      {
        name: 'Bình luận',
        path: '/news-comments',
        permission: { resource: 'comments', action: 'approve' },
      },
    ],
  },
  // ── Vận hành ──
  {
    icon: <AlertTriangle />,
    name: 'Phản ánh hiện trường',
    path: '/feedbacks',
    permission: { resource: 'feedback', action: 'read' },
  },
  // {
  //   icon: <Bell />,
  //   name: 'Gửi thông báo',
  //   path: '/notifications/send',
  //   permission: { resource: 'notifications', action: 'send' },
  // },

  // ── Quản trị ──
  {
    icon: <Users />,
    name: 'Người dùng',
    path: '/users',
    permission: { resource: 'users', action: 'read' },
  },
  {
    icon: <MessageSquare />,
    name: 'Tài liệu hệ thống',
    path: 'http://103.163.119.247:8881/uploads/dl_hdsd_admin.docx',
  },
]
