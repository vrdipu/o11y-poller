const express = require('express');
const k8s = require('@kubernetes/client-node');
const app = express();
const port = 3000;

// Kubernetes client setup
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = k8s.CoreV1Api;  // Adjust the way you create the API client
const coreV1Api = new k8sApi(kc.getCurrentCluster().server);  // Use the cluster server from kubeconfig
const logApi = new k8s.Log(kc.getCurrentCluster().server);

// Store resources status
let resourcesStatus = {};

// Poll Kubernetes API every 2 seconds
setInterval(async () => {
    try {
        const podList = await coreV1Api.listNamespacedPod('observability');
        const serviceList = await coreV1Api.listNamespacedService('observability');

        resourcesStatus = {
            pods: podList.body.items.map(pod => ({
                name: pod.metadata.name,
                ip: pod.status.podIP,
                status: pod.status.phase,
                namespace: pod.metadata.namespace
            })),
            services: serviceList.body.items.map(service => ({
                name: service.metadata.name,
                type: service.spec.type,
                namespace: service.metadata.namespace,
                endpoints: service.spec.ports.map(port => `${service.spec.clusterIP}:${port.port}`)
            }))
        };
        console.log('Resources status updated');
    } catch (error) {
        console.error('Error fetching resources:', error);
    }
}, 2000);

// API to get the latest resources status
app.get('/resources', (req, res) => {
    res.json(resourcesStatus);
});

// API to get pod logs
app.get('/logs', async (req, res) => {
    const { namespace, pod } = req.query;
    try {
        const logs = await logApi.readNamespacedPodLog(pod, namespace);
        res.send(logs.body);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).send('Error fetching logs');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Node.js app listening at http://localhost:${port}`);
});
