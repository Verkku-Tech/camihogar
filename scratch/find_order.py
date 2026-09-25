import subprocess

cmd = [
    'ssh', '-p', '9888', '-o', 'StrictHostKeyChecking=no', 'sa@localhost',
    'sudo docker exec -i ordina-mongodb mongosh -u admin -p "OrdinaPassword123!" --authenticationDatabase admin --quiet ordina_db --eval "const u = db.users.findOne({username: \'usuariodev\'}); print(JSON.stringify({username: u.username, passwordHash: u.passwordHash}));"'
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("USERDEV:", res.stdout)
