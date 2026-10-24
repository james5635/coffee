For a coffee shop web app, I recommend starting with 5 user roles: Owner/Admin, Manager, Cashier, Barista, and Customer. This covers the core workflows without making your authorization system unnecessarily complicated.

## 1. Recommended user roles

[Female small business owner stands behind the bar, smiling warmly at the camera, laptop open beside her](https://images.openai.com/static-rsc-4/86ZLkki8BG-rIV3OopOB8OIN2Fk1LunLY6muKyQ8_mn58XEj6nRIfjHYbULt0n5n8I5O53A-Mk3KFgV7B_ekJZlCMN7uCLwX-iOoDFiiOnySAb0eywyl2SfncGDlk4cQKLlR8JU26NNKXZlXx_HDT4rWm-d_D-dTV6Aif70ZrkGXgPvcI5b02q4R7PJ4DS6_?purpose=inline)

1\. Owner / Admin

Full access

Owns and configures the coffee shop.

Permissions: manage users and roles, configure shop settings, manage menu and prices, access all orders and inventory, view financial reports, issue refunds, and manage branches.

[Handsome Caucasian Coffee Shop Owner is Working on Tablet Computer and Checking Inventory in a Cozy Loft-Style Cafe. Successful Restaurant Manager Standing Happy Behind Counter.](https://images.openai.com/static-rsc-4/muXc3P48y5IQT_HZF1DUDBtkozVQv03FhM6iyeOCYcdzMt0r0x9hazIKNhPKbtCXDVTXvucY78c1502MV_p-7Nqd7zTA5XNMIKowTNYkJAjvW3OLq3VeILKWOgnToM3-4ThKcOcPYBL1GBXQxxS3ldv9uVCiPqp_cl_1hMe_izRHny99fxcSpeR8MClvyptJ?purpose=inline)

2\. Manager

Operational access

Handles daily operations and supervises employees.

Permissions: manage menu availability, oversee orders, manage stock and suppliers, supervise staff, view sales reports, apply approved discounts, and approve refunds within configured limits.

[Sistema POS con facturación electrónica en Costa Rica: qué debe incluir | Blog Facturar Online](https://images.openai.com/static-rsc-4/pp19EOT2aBVeiWhH-yyoU1u0Ia_wS-flWlGrDy6YD3uIJVvoC7be8xuBmuCRYwEeZV8XKFvds8fXKSMA5LdlLM7bHwLm0n84rjaDl_48BxA9TIDGh0InyTRVC0VW3E6zi5tq4v3GhsZc7pxw-uuH-JQ0ehInQQDQ8xrBHttA6Ec?purpose=inline)

3\. Cashier

Sales access

Takes customer orders and handles payments.

Permissions: create orders, edit unpaid orders, accept payments, print receipts, apply permitted discounts, and view relevant order history. Refunds and cancellations after payment require authorization if restricted by the owner.

[Kaffee in bester getesteter Qualität        – Kaffeegeniesser](https://images.openai.com/static-rsc-4/g8oGy6750e_kJSlkb2h0kKVDSt_GNbtxnOcew5OapK-KQerAHkKxgv1pWLee17tw-DzY_kzUK5IR1TabPyteSy9MF98QU0G_rJ2DStCJ8sThW9dHDo-8HEc9q1lzf5hyBVE724aT1Bb9UzS_lf1SYHi1udjHFV5i0RPkjA0bJmw?purpose=inline)

4\. Barista

Order preparation

Prepares drinks and updates order progress.

Permissions: view accepted orders, see drink specifications and special requests, mark orders as preparing or ready, and mark preparation complete. Cannot change prices, record payments, or issue refunds.

[Sell Online - Build F&B Online Ordering in 5 Minutes | iSeller Online Ordering](https://images.openai.com/static-rsc-4/2_FFhyPk6UEh8m4UJUqoNelvaIWFxqwgeJJBjyDRCMmHTZKjPL3qsuqKLPxRIhyib_tsbz95Kwsb-HpQi9iSgIw2-61VoV-ZOBATqwnout4elem8rJUvds59QPfzMySzvStSKntNNxs7bFWdoqWGWHIMNM49LpNspTMJ1jffL7I?purpose=inline)

5\. Customer

Personal account

Browses the menu and places orders.

Permissions: view available products and prices, place orders, pay, view their own order history, manage their profile, and use loyalty rewards. Can cancel their own order only when the order is still eligible for cancellation.

Important: Customers are optional as authenticated users. Your website can allow guest ordering, so customers do not necessarily need an account.

## 2. Permission matrix

This matrix is a starting point for your access-control design. “Own” means the user's own records, while “All” means records within the shop or branch they are authorized to access.

| Feature / Permission              | Owner/Admin | Manager  | Cashier                   | Barista                | Customer     |
| --------------------------------- | ----------- | -------- | ------------------------- | ---------------------- | ------------ |
| View menu                         | All         | All      | All                       | Relevant items         | Public menu  |
| Create/edit products and prices   | Yes         | Yes      | No                        | No                     | No           |
| Manage categories and modifiers   | Yes         | Yes      | No                        | No                     | No           |
| Create orders                     | Yes         | Yes      | Yes                       | No                     | Yes          |
| View orders                       | All         | All      | Assigned/permitted orders | Preparation queue      | Own          |
| Update order status               | Yes         | Yes      | Limited                   | Preparation statuses   | No           |
| Accept payments                   | Yes         | Yes      | Yes                       | No                     | Own checkout |
| Issue refunds                     | Yes         | Limited  | No by default             | No                     | Request only |
| Manage inventory                  | Yes         | Yes      | Limited stock lookup      | Report usage/low stock | No           |
| Manage suppliers                  | Yes         | Yes      | No                        | No                     | No           |
| View sales reports                | All         | Yes      | Limited                   | No                     | Own orders   |
| View profit and financial reports | Yes         | Optional | No                        | No                     | No           |
| Manage staff accounts and roles   | Yes         | Limited  | No                        | No                     | No           |
| Configure shop settings           | Yes         | Limited  | No                        | No                     | No           |
| Manage own profile                | Yes         | Yes      | Yes                       | Yes                    | Yes          |

Some permissions, such as refunds and discounts, should be configurable rather than hard-coded to a role. For instance, a manager might approve a refund, while a cashier can only request one.

## 3. Define granular permissions in your backend

Rather than putting role names everywhere in your code, define permissions and assign them to roles.

A useful permission naming scheme:

| Module    | Example permissions                                                                       |
| --------- | ----------------------------------------------------------------------------------------- |
| Products  | `product.read`, `product.create`, `product.update`, `product.delete`                      |
| Orders    | `order.create`, `order.read.all`, `order.read.own`, `order.update_status`, `order.cancel` |
| Payments  | `payment.accept`, `payment.refund`                                                        |
| Inventory | `inventory.read`, `inventory.adjust`, `inventory.manage`                                  |
| Reports   | `report.sales.read`, `report.profit.read`                                                 |
| Employees | `user.read`, `user.create`, `user.update`, `user.disable`, `role.manage`                  |
| Settings  | `settings.read`, `settings.update`                                                        |
| Discounts | `discount.apply`, `discount.manage`                                                       |

For example:

```
Owner/Admin
  -> All permissions

Manager
  -> product.*
  -> order.*
  -> inventory.*
  -> report.sales.read
  -> payment.refund (subject to limits)
  -> selected user-management permissions

Cashier
  -> product.read
  -> order.create
  -> order.read.assigned
  -> order.update_unpaid
  -> payment.accept
  -> discount.apply

Barista
  -> order.read.preparation_queue
  -> order.update_status

Customer
  -> product.read
  -> order.create
  -> order.read.own
  -> order.cancel.own (subject to order status)
  -> profile.manage.own
```

The example is conceptual: the `*` wildcard and permission names are conventions you would implement in your own authorization system.

## 4. How I would structure the system

Use RBAC (Role-Based Access Control): users receive roles, and roles receive permissions.

\#chatgpt-mermaid-\_r_en\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_en\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_en\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_en\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_en\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_en\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_en\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_en\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_en\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_en\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_en\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_en\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_en\_ p{margin:0;}#chatgpt-mermaid-\_r_en\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_en\_ .label text,#chatgpt-mermaid-\_r_en\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ .node rect,#chatgpt-mermaid-\_r_en\_ .node circle,#chatgpt-mermaid-\_r_en\_ .node ellipse,#chatgpt-mermaid-\_r_en\_ .node polygon,#chatgpt-mermaid-\_r_en\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .rough-node .label text,#chatgpt-mermaid-\_r_en\_ .node .label text,#chatgpt-mermaid-\_r_en\_ .image-shape .label,#chatgpt-mermaid-\_r_en\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_en\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .rough-node .label,#chatgpt-mermaid-\_r_en\_ .node .label,#chatgpt-mermaid-\_r_en\_ .image-shape .label,#chatgpt-mermaid-\_r_en\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_en\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_en\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_en\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_en\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_en\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_en\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_en\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_en\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_en\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_en\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_en\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_en\_ .icon-shape,#chatgpt-mermaid-\_r_en\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_en\_ .icon-shape p,#chatgpt-mermaid-\_r_en\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_en\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_en\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_en\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_en\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_en\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_en\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_en\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_en\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_en\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_en\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_en\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_en\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_en\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_en\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_en\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_en\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_en\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .node rect,#chatgpt-mermaid-\_r_en\_ .node circle,#chatgpt-mermaid-\_r_en\_ .node ellipse,#chatgpt-mermaid-\_r_en\_ .node polygon,#chatgpt-mermaid-\_r_en\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_en\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_en\_ .node.mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_en\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_en\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_en\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}UserUser Role AssignmentRoleRole-Permission AssignmentPermissionBackend AuthorizationProtected Resource

For example, your backend might have these entities:

- `User` — login and account information.
- `Role` — Owner, Manager, Cashier, Barista, Customer.
- `Permission` — individual actions the system allows.
- `UserRole` — assigns roles to users.
- `RolePermission` — assigns permissions to roles.

The backend must enforce permissions on every protected operation. Hiding a button in the frontend is not security by itself.

## 5. Which roles should you implement first?

For a single coffee shop MVP, begin with four internal roles: Owner/Admin, Manager, Cashier, and Barista. Add Customer as an authenticated role when you implement customer accounts, online ordering, or loyalty programs.

You can keep inventory management under Manager at first. Add a dedicated Inventory Staff role only when stock management becomes a separate responsibility. Likewise, add a Platform Admin only if you're building a multi-shop SaaS product where your company manages multiple coffee shops.

