import { test, expect } from '@playwright/test'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123'
let slugCounter = 0

function uniqueSlug(prefix = 'e2e') {
  slugCounter += 1
  return `${prefix}_${Date.now()}_${slugCounter}`
}

async function login(page, username = ADMIN_USER, password = ADMIN_PASS) {
  await page.goto('/')
  await page.waitForURL('**/login')
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/tenants')
}

async function createTenantViaApi(page, slug: string, displayName: string) {
  await page.request.post('/api/tenants', {
    data: { tenant_slug: slug, display_name: displayName },
  })
}

// ─── 1. Login flow ─────────────────────────────────────────────────────────

test.describe('Login', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('logs in and redirects to /tenants', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/tenants/)
    await expect(page.locator('h1')).toContainText('Tenants')
  })
})

// ─── 2. Create tenant ──────────────────────────────────────────────────────

test.describe('Create tenant', () => {
  test('creates a tenant via wizard and shows it in the list', async ({ page }) => {
    await login(page)

    const slug = uniqueSlug('create')
    await page.click('text=Novo Tenant')
    await expect(page).toHaveURL(/\/tenants\/new/)

    // Step 1 – Identificação
    await page.fill('input[placeholder*="jaboatao"]', slug)
    await page.fill('input[placeholder*="Jaboatão"]', 'Tenant E2E Create')
    await page.click('text=Próximo')

    // Steps 2-5: click Próximo without filling optional fields
    for (let i = 0; i < 4; i++) {
      await page.click('text=Próximo')
    }

    // Step 6 – Revisão: click save
    await page.click('button:has-text("Criar tenant")')
    await page.waitForURL(/\/tenants\/\d+/)

    // Go back to list and verify
    await page.click('text=Tenants')
    await expect(page.locator(`text=${slug}`)).toBeVisible()
  })
})

// ─── 3. Tenant detail ──────────────────────────────────────────────────────

test.describe('Tenant detail', () => {
  test('shows tenant detail page with correct data', async ({ page }) => {
    await login(page)

    const slug = uniqueSlug('detail')
    await createTenantViaApi(page, slug, 'Tenant Detail E2E')

    await page.goto('/tenants')
    await page.click(`text=${slug}`)
    await page.waitForURL(/\/tenants\/\d+/)

    await expect(page.locator('h1')).toContainText('Tenant Detail E2E')
    await expect(page.locator(`text=${slug}`)).toBeVisible()
  })
})

// ─── 4. Edit tenant ────────────────────────────────────────────────────────

test.describe('Edit tenant', () => {
  test('edits tenant display name and persists', async ({ page }) => {
    await login(page)

    const slug = uniqueSlug('edit')
    await createTenantViaApi(page, slug, 'Original Name')

    // Go to detail and click Edit
    await page.goto('/tenants')
    await page.click(`text=${slug}`)
    await page.click('text=Editar')
    await page.waitForURL(/\/tenants\/\d+\/edit/)

    // Change display_name
    const nameInput = page.locator('input').nth(1) // second input is display_name
    await nameInput.clear()
    await nameInput.fill('Updated Name')

    // Go through all steps to Review
    for (let i = 0; i < 5; i++) {
      await page.click('text=Próximo')
    }

    await page.click('text=Salvar alterações')
    await page.waitForURL(/\/tenants\/\d+$/)

    await expect(page.locator('h1')).toContainText('Updated Name')
  })
})

// ─── 5. Deactivate tenant ──────────────────────────────────────────────────

test.describe('Deactivate tenant', () => {
  test('deactivates a tenant and shows inactive badge', async ({ page }) => {
    await login(page)

    const slug = uniqueSlug('deact')
    await createTenantViaApi(page, slug, 'Tenant Deactivate')

    await page.goto('/tenants')
    await page.click(`text=${slug}`)
    await page.waitForURL(/\/tenants\/\d+$/)

    // Click Desativar
    await page.click('text=Desativar')
    // Wait for the badge to update
    await expect(page.locator('span:has-text("Inativo")')).toBeVisible()

    // Go back to list and check status
    await page.click('text=Tenants')
    await expect(page.locator(`text=${slug}`)).toBeVisible()
    // The row should show inactive badge
    const row = page.locator(`tr:has-text("${slug}")`)
    await expect(row.locator('span:has-text("Inativo")')).toBeVisible()
  })
})

// ─── 6. Delete tenant ──────────────────────────────────────────────────────

test.describe('Delete tenant', () => {
  test('deletes a tenant and removes from list', async ({ page }) => {
    await login(page)

    const slug = uniqueSlug('del')
    await createTenantViaApi(page, slug, 'Tenant Delete')

    await page.goto('/tenants')
    await page.click(`text=${slug}`)
    await page.waitForURL(/\/tenants\/\d+$/)

    // Click Excluir
    await page.click('text=Excluir')
    // Confirm in modal
    await page.click('text=Excluir permanentemente')
    await page.waitForURL('**/tenants')

    // Verify removed
    await expect(page.locator(`text=${slug}`)).not.toBeVisible()
  })
})

// ─── 7. API Keys ───────────────────────────────────────────────────────────

test.describe('API Keys', () => {
  test('creates an API key and shows it once', async ({ page }) => {
    await login(page)

    await page.goto('/api-keys')
    await expect(page.locator('h1')).toContainText('API Keys')

    const keyName = `e2e-key-${Date.now()}`
    await page.click('text=Criar chave')
    await page.fill('input[placeholder*="n8n"]', keyName)
    await page.click('button:has-text("Criar")')

    // The key value should be shown (once)
    const codeBlock = page.locator('code')
    await expect(codeBlock).toBeVisible()
    const keyValue = await codeBlock.textContent()
    expect(keyValue).toBeTruthy()

    // Close the modal
    await page.click('text=Fechar')

    // The key should appear in the table
    await expect(page.locator(`text=${keyName}`)).toBeVisible()

    // Verify the raw key is NOT shown in the table
    if (keyValue) {
      await expect(page.locator('td code').filter({ hasText: keyValue })).not.toBeVisible()
    }
  })
})

// ─── 8. Account ────────────────────────────────────────────────────────────

test.describe('Account', () => {
  test('updates full name and persists', async ({ page }) => {
    await login(page)

    await page.click('text=Minha Conta')
    await page.waitForURL('**/account')

    const newName = `Admin ${Date.now()}`
    const nameInput = page.locator('input[type="text"]').first()
    await nameInput.clear()
    await nameInput.fill(newName)

    await page.click('text=Salvar dados')
    await expect(page.locator('text=Dados atualizados com sucesso.')).toBeVisible()
  })
})
