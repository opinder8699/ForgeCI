const prisma = require("../../lib/prisma");

// GET /api/runs/:id
// GET /api/runs/:id/logs
exports.getRunLogs = async (req, res) => {
  try {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: req.params.id },
      include: {
        pipeline: {
          select: {
            userId: true,
          },
        },
        steps: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            status: true,
            logs: true,
            order: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });

    if (!run || run.pipeline.userId !== req.user.userId) {
      return res.status(404).json({ message: "Run not found" });
    }

    const logs = [];

    // =========================
    // Clone repository step
    // =========================

    if (run.cloneLogs) {
      logs.push({
        type: "step_start",
        stepId: `clone-${run.id}`,
        stepName: "Clone repository",
        order: 0,
      });

      run.cloneLogs
        .split("\n")
        .filter((line) => line.trim())
        .forEach((line) => {
          logs.push({
            type: "log",
            message: line.trimEnd(),
            stepId: `clone-${run.id}`,
            stepName: "Clone repository",
          });
        });

      logs.push({
        type: "step_end",
        stepId: `clone-${run.id}`,
        stepName: "Clone repository",
        status: "SUCCESS",
      });
    }

    // =========================
    // Normal pipeline steps
    // =========================

    run.steps.forEach((step) => {
      logs.push({
        type: "step_start",
        stepId: step.id,
        stepName: step.name,
        order: step.order,
      });

      if (step.logs) {
        step.logs
          .split("\n")
          .filter((line) => line.trim())
          .forEach((line) => {
            logs.push({
              type: "log",
              message: line.trimEnd(),
              stepId: step.id,
              stepName: step.name,
            });
          });
      }

      logs.push({
        type: "step_end",
        stepId: step.id,
        stepName: step.name,
        status: step.status,
      });
    });

    // =========================
    // Final pipeline status
    // =========================

    logs.push({
      type: "RUN_COMPLETED",
      status: run.status,
      runId: run.id,
      ...(run.status === "FAILED" && {
        error: "Pipeline failed",
      }),
    });

    return res.json({ logs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
// exports.getRunLogs = async (req, res) => {
//   try {
//     const run = await prisma.pipelineRun.findUnique({
//       where: { id: req.params.id },
//       include: {
//         pipeline: { select: { userId: true } },
//         steps: {
//           orderBy: { order: "asc" },
//           select: {
//             id: true,
//             name: true,
//             status: true,
//             logs: true,
//             order: true,
//             startedAt: true,
//             completedAt: true,
//           },
//         },
//       },
//     });

//     if (!run || run.pipeline.userId !== req.user.userId) {
//       return res.status(404).json({ message: "Run not found" });
//     }

//     const logs = run.steps.flatMap((step) => {
//       const lines = [];

//       // step_start shape must match exactly what the worker publishes via socket
//       lines.push({
//         type: "step_start",
//         stepId: step.id,
//         stepName: step.name,      // ← was missing: causes "▶Step :" with no name
//         order: step.order,        // ← was missing: causes "Step :" with no number
//       });

//       if (step.logs) {
//         step.logs.split("\n").forEach((line) => {
//           if (line.trim()) {
//             lines.push({
//               type: "log",
//               message: line.trimEnd(),  // ← use `message` not `logs`, match socket shape
//               stepId: step.id,
//               stepName: step.name,
//             });
//           }
//         });
//       }

//       // step_end shape must also match socket
//       lines.push({
//         type: "step_end",
//         stepId: step.id,
//         stepName: step.name,      // ← was missing
//         status: step.status,      // ← keep as "SUCCESS"/"FAILED" not lowercased
//       });

//       return lines;
//     });

//     // Append a RUN_COMPLETED event so the frontend renders the final banner
//     // even on a refreshed completed run
//     logs.push({
//       type: "RUN_COMPLETED",
//       status: run.status,
//       runId: run.id,
//       ...(run.status === "FAILED" && { error: "Pipeline failed" }),
//     });

//     return res.json({ logs });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };
exports.getRunById = async (req, res) => {
  try {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: req.params.id },
      include: {
        pipeline: { select: { userId: true, name: true, branch: true } },
      },
    });

    if (!run || run.pipeline.userId !== req.user.userId) {
      return res.status(404).json({ message: "Run not found" });
    }

    return res.json({
      run: {
        id: run.id,
        status: run.status,
        branch: run.pipeline.branch,
        pipelineId: run.pipelineId,
        pipelineName: run.pipeline.name,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        durationSeconds:
          run.startedAt && run.completedAt
            ? Math.round(
                (new Date(run.completedAt) - new Date(run.startedAt)) / 1000,
              )
            : null,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// // GET /api/runs/:id/logs
// exports.getRunLogs = async (req, res) => {
//   try {
//     const run = await prisma.pipelineRun.findUnique({
//       where: { id: req.params.id },
//       include: {
//         pipeline: { select: { userId: true } },
//         steps: {
//           orderBy: { order: "asc" },
//           select: {
//             id: true,
//             name: true,
//             status: true,
//             logs: true,
//             order: true,
//             startedAt: true,
//             completedAt: true,
//           },
//         },
//       },
//     });

//     if (!run || run.pipeline.userId !== req.user.userId) {
//       return res.status(404).json({ message: "Run not found" });
//     }

//     const logs = run.steps.flatMap((step) => {
//       const lines = [];
//       lines.push({
//         type: "step_start",
//         message: `▶ Step ${step.order}: ${step.name}`,
//         stepId: step.id,
//         stepStatus: step.status,
//       });
//       if (step.logs) {
//         step.logs.split("\n").forEach((line) => {
//           if (line.trim()) {
//             lines.push({ type: "log", message: line, stepId: step.id });
//           }
//         });
//       }
//       lines.push({
//         type: "step_end",
//         message: `${step.status === "SUCCESS" ? "✓" : "✗"} ${step.name} [${step.status?.toLowerCase()}]`,
//         stepId: step.id,
//         stepStatus: step.status,
//       });
//       return lines;
//     });

//     return res.json({ logs });
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// };

// DELETE /api/runs/:id
exports.deleteRun = async (req, res) => {
  try {
    const run = await prisma.pipelineRun.findUnique({
      where: { id: req.params.id },
      include: { pipeline: { select: { userId: true } } },
    });

    if (!run || run.pipeline.userId !== req.user.userId) {
      return res.status(404).json({ message: "Run not found" });
    }

    await prisma.pipelineStep.deleteMany({ where: { runId: req.params.id } });
    await prisma.pipelineRun.delete({ where: { id: req.params.id } });

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};