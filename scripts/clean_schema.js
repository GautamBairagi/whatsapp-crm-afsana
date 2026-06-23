const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

const modelsToRemove = [
  'WorkingHours',
  'SecuritySetting',
  'SuperAdminDashboard',
  'AdminDashboard',
  'ManagerDashboard',
  'TeamLeaderDashboard',
  'CounselorPerformance',
  'CounselorDashboard',
  'SupportDashboard',
  'Template',
  'Rota',
  'Customer',
  'WhatsappMessage',
  'Task',
  'Report'
];

for (const model of modelsToRemove) {
  // Regex to match a block like `model ModelName { ... }`
  const regex = new RegExp(`model ${model} \\{[\\s\\S]*?\\n\\}\\n?`, 'g');
  schema = schema.replace(regex, '');
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema cleaned successfully.');
