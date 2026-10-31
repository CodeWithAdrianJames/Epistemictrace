package com.episteme.epistemictrace.sdi;

import java.time.Duration;

/**
 * The four struggle signals for one RUN (spec 19 R6): raw values and their normalized values, each in {@code [0, 1]}.
 * @param runs RUN events in the window, including the scored run
 * @param medianGap median edit-to-run time over those runs
 * @param repeats ERROR events in the window minus their distinct signatures
 * @param noProgressRuns runs in the window that did not raise the session's best passed count
 * @param runFrequency normalized signal 1
 * @param editToRun normalized signal 2
 * @param repeatedErrors normalized signal 3
 * @param noProgress normalized signal 4
 */
public record Signals(int runs, Duration medianGap, int repeats, int noProgressRuns, double runFrequency,
		double editToRun, double repeatedErrors, double noProgress) {

}
